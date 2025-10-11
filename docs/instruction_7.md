# CWS — Multi‑Mode ETA & Tollgate UI Implementation Guide (Final, Live APIs)

**Goal**
Ship a production‑ready UX that:

* Lets users choose **Car** or **Transit**.
* Always fetches **both** ETAs on the server for **comparison + recommendation copy**.
* When **Car** is selected, shows **tollgate congestion** detected along the car route.
* Works in **live** mode when `MOCK=0`, and **fail‑open** (fixtures/fallbacks) when `MOCK=1`.

**Do not** break the existing Car ETA + tollgate pipeline. Keep the current **fail‑open** behavior.

---

## 0) System Overview

```
Frontend (React/TS) ─┬── /traffic/city     (aggregated: car + transit + recommendation)
                     ├── /traffic/car      (single mode)
                     ├── /traffic/transit  (single mode)
                     └── /traffic/route-tollgates (car polyline → tollgates + congestion)

Server (Node/Express/TS)
  ├─ adapters/
  │   ├─ tmap.adapter.ts         # car + transit live callers (MOCK gates)
  │   └─ expressway.adapter.ts   # Korea Expressway congestion, TTL/caching
  ├─ services/
  │   ├─ traffic.service.ts      # orchestration: routes, map, tollgate match
  │   └─ recommend.service.ts    # ETA comparison → recommendation text/meta
  ├─ routes/
  │   ├─ traffic.routes.ts       # HTTP: /traffic/* endpoints
  │   └─ briefing.routes.ts      # (optional) existing brief/summary API
  └─ lib/
      ├─ env.ts                  # reads env + feature flags
      └─ util.ts                 # geometry helpers, polyline ↔ tollgate matching
```

---

## 1) Environment & Feature Flags

**Live vs Mock**

* `MOCK=0` → **live**: call real TMAP (car + transit) + Korea Expressway.
* `MOCK=1` → **fail‑open**: try live first, but fall back to fixtures if upstream fails; or serve fixtures directly where applicable.

**.env example**

```bash
# Live/Mock mode
MOCK=0                  # 0=live, 1=mock (fail‑open)

# TMAP
TMAP_API_KEY=xxxxx      # Your App Key (same for multiple products)
TMAP_BASE_URL=https://apis.openapi.sk.com
# Optional per‑product base paths if you keep them separate
TMAP_CAR_PATH=/tmap/routes/car
TMAP_TRANSIT_PATH=/tmap/routes/transit

# Korea Expressway (DoGong)
EXPRESSWAY_API_KEY=xxxxx
EXPRESSWAY_BASE_URL=https://xxx.expressway.or.kr

# Feature flags
UI_SHOW_TOLLGATE=true
ETA_TIE_THRESHOLD_MIN=3
RECOMMEND_WEATHER_WEIGHT=1.0
```

> **Note.** In the TMAP developer console, make sure your **App** includes **both** products: *Car routing / 자동차 길찾기* and *Transit / 대중교통 길찾기*. They share **one** App Key (`TMAP_API_KEY`).

---

## 2) API Contracts (What the UI consumes)

### 2.1 Aggregated (recommended for UX)

**GET** `/traffic/city?from=<lat,lon>&to=<lat,lon>&at=<ISO>`

```json
{
  "ok": true,
  "data": {
    "car": {
      "mode": "car",
      "eta_minutes": 34,
      "distance_km": 21.3,
      "polyline": { "type": "LineString", "coordinates": [[127.0,37.5],[...]] },
      "tollgates": [
        {
          "code": "TG1234",
          "name": "Seoul Tollgate",
          "lat": 37.4901,
          "lon": 127.1012,
          "congestion": "MODERATE",  
          "speed_kph": 43,
          "delay_min": 3,
          "updated_at": "2025-10-10T02:10:00Z"
        }
      ],
      "source": "tmap",
      "source_status": "ok"   // ok | mock | degraded | error
    },
    "transit": {
      "mode": "transit",
      "eta_minutes": 41,
      "distance_km": 19.7,
      "fare_krw": 1450,
      "transfers": 1,
      "steps": [
        { "kind": "walk",   "name": "",       "duration_min": 4 },
        { "kind": "subway", "name": "Line 2", "duration_min": 21 },
        { "kind": "walk",   "name": "",       "duration_min": 6 }
      ],
      "notes": [],
      "source": "tmap",
      "source_status": "ok"
    },
    "recommendation": {
      "mode": "car",           
      "delta_min": 7,
      "reasons": ["eta_gap", "rain_forecast"]
    }
  }
}
```

### 2.2 Single‑mode fallbacks

* **GET** `/traffic/car?from=<lat,lon>&to=<lat,lon>&at=<ISO>` → same `car` object as above.
* **GET** `/traffic/transit?from=<lat,lon>&to=<lat,lon>&at=<ISO>` → same `transit` object as above.
* **GET** `/traffic/route-tollgates?from=<lat,lon>&to=<lat,lon>&at=<ISO>` → `{ ok, data: TollgateInfo[] }` (kept for backward compatibility and testing; the aggregated endpoint already embeds tollgates under `data.car.tollgates`).

---

## 3) Backend: What to (lightly) add or adjust

### 3.1 Implement/enable **live transit caller** when `MOCK=0`

File: `server/src/adapters/tmap.adapter.ts`

* Add a live function (or un‑stub the existing) to call TMAP **Transit** once `MOCK===0`.
* Use the same HTTP helper and header pattern as the **Car** caller:

  * Header: `appKey: TMAP_API_KEY`
  * Coords: **startX/startY** = (lon/lat of origin), **endX/endY** = (lon/lat of destination)
  * Time: `at`/`startTime` if supported; otherwise use server current time
* Normalize the response into the project’s `TransitBrief` shape: `{ eta_minutes, distance_km?, fare_krw?, transfers?, steps[], notes[], source_status }`.

Pseudo‑code

```ts
export async function routeTransit(params: { from:[number,number]; to:[number,number]; at?: string }) {
  const useMock = env.MOCK === 1;
  if (useMock) return fixtures.transitBrief();

  const url = `${env.TMAP_BASE_URL}${env.TMAP_TRANSIT_PATH}`; // e.g. /tmap/routes/transit
  const query = {
    startX: params.from[1], startY: params.from[0],
    endX: params.to[1],   endY: params.to[0],
    // add time fields if your chosen TMAP endpoint supports them
  };
  try {
    const res = await http.get(url, { headers: { appKey: env.TMAP_API_KEY }, params: query });
    return normalizeTransitRoute(res.data); // → TransitBrief (source_status: 'ok')
  } catch (e) {
    if (env.FAIL_OPEN) return { ...fixtures.transitBrief(), source_status: 'degraded' };
    throw e;
  }
}
```

### 3.2 Add the **aggregator route** `/traffic/city`

File: `server/src/routes/traffic.routes.ts`

```ts
router.get('/city', async (req, res) => {
  try {
    const { from, to, at } = parseCoordOrGeocode(req.query); // already used by /car

    // Parallel fetch: car + transit
    const [car, transit] = await Promise.all([
      trafficService.getCarBrief({ from, to, at }),
      trafficService.getTransitBrief({ from, to, at }),
    ]);

    // Attach tollgates for Car (reuses existing match + DoGong calls)
    let enrichedCar = car;
    if (car?.polyline) {
      const tollgates = await trafficService.getRouteTollgates({ from, to, at, polyline: car.polyline });
      enrichedCar = { ...car, tollgates };
    }

    const recommendation = recommendService.pickMode({ car: enrichedCar, transit, tieThresholdMin: env.ETA_TIE_THRESHOLD_MIN });

    res.json({ ok: true, data: { car: enrichedCar, transit, recommendation } });
  } catch (e:any) {
    res.status(500).json({ ok:false, error: 'city_fetch_failed', message: e?.message });
  }
});
```

> **Note.** Keep `/traffic/car` and `/traffic/route-tollgates` as they are (great for debugging). The aggregated route only composes existing building blocks.

### 3.3 Keep **fail‑open** semantics

* On any upstream failure (TMAP/Expressway), if `MOCK=1` or `FAIL_OPEN=true`, return a mocked or cached object with `source_status: 'degraded' | 'mock'`.
* The UI renders a subtle badge or info line when `source_status !== 'ok'`.

---

## 4) Frontend: Types, Client, Components

### 4.1 Shared Types `src/lib/types/traffic.ts`

```ts
export type TravelMode = 'car' | 'transit';

export interface TollgateInfo {
  code: string; name: string; lat: number; lon: number;
  congestion: 'SMOOTH' | 'MODERATE' | 'CONGESTED' | 'BLOCKED';
  speed_kph?: number; delay_min?: number; updated_at?: string;
}

export interface CarBrief {
  mode: 'car';
  eta_minutes: number;
  distance_km?: number;
  polyline?: GeoJSON.LineString;
  tollgates?: TollgateInfo[];
  source?: string;
  source_status?: 'ok'|'mock'|'degraded'|'error';
}

export interface TransitStep { kind: string; name?: string; duration_min?: number }
export interface TransitBrief {
  mode: 'transit'; eta_minutes: number; distance_km?: number;
  fare_krw?: number; transfers?: number; steps?: TransitStep[]; notes?: string[];
  source?: string; source_status?: 'ok'|'mock'|'degraded'|'error';
}

export interface CityTraffic {
  car?: CarBrief | null;
  transit?: TransitBrief | null;
  recommendation?: { mode: 'car'|'transit'|'tie'; delta_min?: number; reasons?: string[] };
}
```

### 4.2 API Client `src/lib/api/traffic.ts`

```ts
const BASE = '/traffic';

async function asJson<T>(res: Response) { if (!res.ok) throw new Error(await res.text()); return (await res.json()).data as T; }

export async function fetchCity(params: { from: [number, number]; to: [number, number]; at?: string }) {
  const q = new URLSearchParams({ from: params.from.join(','), to: params.to.join(','), ...(params.at ? { at: params.at } : {}) });
  return asJson<import('../types/traffic').CityTraffic>(await fetch(`${BASE}/city?${q.toString()}`));
}

export async function fetchCar(params: { from: [number, number]; to: [number, number]; at?: string }) {
  const q = new URLSearchParams({ from: params.from.join(','), to: params.to.join(','), ...(params.at ? { at: params.at } : {}) });
  return asJson<import('../types/traffic').CarBrief>(await fetch(`${BASE}/car?${q.toString()}`));
}

export async function fetchTransit(params: { from: [number, number]; to: [number, number]; at?: string }) {
  const q = new URLSearchParams({ from: params.from.join(','), to: params.to.join(','), ...(params.at ? { at: params.at } : {}) });
  return asJson<import('../types/traffic').TransitBrief>(await fetch(`${BASE}/transit?${q.toString()}`));
}
```

### 4.3 Core Components

* `ModeSelector.tsx`: radio switch `'car'|'transit'`.
* `EtaCompareCard.tsx`: shows both ETAs + selectable buttons; highlights recommendation.
* `RecommendationBanner.tsx`: renders `city.recommendation` copy.
* `TollgatePanel.tsx` (+ `TollgateLegend.tsx`): list congestion with small color chips and optional delay minutes.

### 4.4 Page orchestration

`src/pages/TravelPage.tsx` (abridged)

```tsx
export default function TravelPage(){
  const [origin, setOrigin] = useState<[number,number] | null>(null); // [lat,lon]
  const [dest, setDest] = useState<[number,number] | null>(null);
  const [mode, setMode] = useState<TravelMode>('car');
  const [city, setCity] = useState<CityTraffic | null>(null);

  const canQuery = !!origin && !!dest;
  useEffect(()=>{ if(!canQuery) return; (async()=>{
    const at = new Date().toISOString();
    const data = await fetchCity({ from: origin!, to: dest!, at });
    setCity(data);
  })(); }, [origin, dest]);

  const car = city?.car; const transit = city?.transit;

  return (
    <div className="space-y-4">
      <ModeSelector value={mode} onChange={setMode} />
      {city && <RecommendationBanner city={city} />}
      <EtaCompareCard car={car||undefined} transit={transit||undefined} selected={mode} onSelect={setMode} />
      {mode==='car' && <TollgatePanel tollgates={car?.tollgates} />}
      {(car?.source_status && car.source_status!=='ok') && <p className="text-xs opacity-70">Car data is {car.source_status}.</p>}
      {(transit?.source_status && transit.source_status!=='ok') && <p className="text-xs opacity-70">Transit data is {transit.source_status}.</p>}
    </div>
  );
}
```

---

## 5) UX Copy & States

* Recommendation examples:

  * `Car is 8 min faster. Recommended.`
  * `Transit is 5 min faster. Recommended.`
  * `Similar ETA. Choose based on comfort or cost.`
  * `Transit recommended due to heavy rain.` (if `reasons` includes weather)
* Off‑hours transit: `Limited service at this time. Try Car or adjust time.`
* Show Tollgate panel only when `mode='car'` **and** there is at least one tollgate.

---

## 6) QA Checklist (server+client)

* [x] `MOCK=0` calls **live** TMAP Car + Transit + Expressway; errors are surfaced; no fixtures.
* [x] `MOCK=1` enables **fail‑open**: mock/fixture on upstream failure, with `source_status = 'mock'|'degraded'`.
* [x] `/traffic/city` returns: `{ car{…tollgates}, transit{…}, recommendation }`.
* [x] `ETA_TIE_THRESHOLD_MIN` respected in recommendation.
* [x] UI mode toggle visually persists and does not force a server re‑query unless origin/dest change.
* [x] Tollgate panel hides when no matched tollgates.
* [x] a11y basics: focus rings on buttons; color contrast.

---

## 7) Dev Test Scenarios (copy‑paste)

**1) Live Car + Transit (daytime)**

```bash
MOCK=0 curl -G "http://localhost:8787/traffic/city" \
  --data-urlencode "from=37.498,127.027" \
  --data-urlencode "to=37.566,126.978" \
  --data-urlencode "at=2025-10-10T11:00:00+09:00"
```

Expect: both modes filled, recommendation set, car.tollgates[] possibly non‑empty.

**2) Nighttime transit**

```bash
MOCK=0 curl -G "http://localhost:8787/traffic/transit" \
  --data-urlencode "from=37.498,127.027" \
  --data-urlencode "to=37.566,126.978" \
  --data-urlencode "at=2025-10-10T02:30:00+09:00"
```

Expect: `notes` includes limited service; `/traffic/city` should still return car.

**3) Fail‑open**

```bash
MOCK=1 curl -G "http://localhost:8787/traffic/city" \
  --data-urlencode "from=37.498,127.027" \
  --data-urlencode "to=37.566,126.978"
```

Expect: `source_status` for any mocked part is `mock|degraded`.

---

## 8) Implementation Notes & Pitfalls

* **Coordinate order**: internally use `[lat,lon]` in FE, but TMAP expects `startX/lon`, `startY/lat`. Stay consistent with your Car adapter.
* **Polyline densification**: if needed, densify for a robust ≤200m tollgate match. Utilities already exist in `lib/util.ts`.
* **Caching**: Expressway congestion can be cached with TTL; keep the existing cache to avoid rate limits.
* **Quotas/429**: backoff + retry with jitter. Respect TMAP/Expressway usage policies.
* **i18n**: funnel all end‑user strings through your translation util; keep English defaults.

---

## 9) i18n Seeds

```json
{
  "mode.car": "Car",
  "mode.transit": "Transit",
  "eta.car": "Car · {min} min",
  "eta.transit": "Transit · {min} min",
  "rec.car": "Car is {min} min faster. Recommended.",
  "rec.transit": "Transit is {min} min faster. Recommended.",
  "rec.tie": "Similar ETA. Choose based on comfort or cost.",
  "transit.limited": "Limited service at this time. Try Car or adjust time.",
  "tollgate.title": "Tollgate Congestion"
}
```

---

## 10) PR Plan

1. **Branch** `feature/transit-ui-tollgate-live`.
2. Commit 1: Transit live caller (`tmap.adapter.ts`), env wiring (`env.ts`).
3. Commit 2: `/traffic/city` route composition + attach `car.tollgates`.
4. Commit 3: FE types + API client + components + page wire‑up.
5. Commit 4: QA fixes; `docs/Transit_Tollgate_UI.md` (this file).

**PR Checklist**

* Screenshots for: Car vs Transit; with/without tollgates; degraded vs ok.
* Server logs show live hits when `MOCK=0` (no fixture code paths taken).
* Unit/integration tests for aggregator and recommend service.
* No regressions on existing Car flow.

---

## 11) Definition of Done

* `MOCK=0` → live TMAP Car + Transit + Expressway; `/traffic/city` returns combined object; FE renders recommendation and, for Car, tollgate panel.
* `MOCK=1` → app remains usable with mocked/degraded sources and clear UI hints.
* All edge states handled (tie ETA, transit off‑hours, no tollgates, throttling).
* Existing functionality preserved; new UX meets the scenario: *user inputs origin/destination, prefers Car → server fetches both → tollgates computed for car → UI shows car ETA + tollgate congestion, and if Transit is better overall it clearly recommends Transit with brief reasoning.*
