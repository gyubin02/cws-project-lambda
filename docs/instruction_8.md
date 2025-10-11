# TMAP Transit Fix & City Briefing UI Integration — Developer Guide (CWS Project)

> **Goal**
>
> 1. Fix the TMAP **Transit** call (wrong base/path/method/param key) with a minimal, copy‑paste‑ready patch. 2) Wire **/briefing → /traffic/city** so the server always computes **both car + transit ETAs**, and the UI cleanly handles the two display cases (preferred = recommended vs. preferred ≠ recommended). 3) Keep the **tollgate congestion** feature unchanged for car mode.

---

## 0) Quick Summary of Changes

* Split env for **car** vs **transit** base URLs.
* Replace incorrect **GET** call to `/routes/transit` under the car base with the correct **POST** to `https://apis.openapi.sk.com/transit/routes`.
* Replace `departure_time` with **`searchDttm`** (format `YYYYMMDDHHmm`).
* Make `/traffic/city` the single aggregator: compute `car` + `transit` in parallel, attach **tollgates** to the `car` brief, and return a unified **recommendation** (`car` | `transit` | `tie`).
* In the UI, **always fetch `/traffic/city`**, and render either a single card (preferred = recommended or tie) or a compare view + recommendation banner (preferred ≠ recommended). When **car** is active, continue to show the **TollgatePanel**.

---

## 1) Server — Environment & URL Builders

### 1.1 `server/src/lib/env.ts`

```diff
-export const ENV = {
-  TMAP_BASE_URL: process.env.TMAP_BASE_URL || 'https://apis.openapi.sk.com/tmap',
-  TMAP_CAR_PATH: process.env.TMAP_CAR_PATH || '/routes',
-  TMAP_TRANSIT_PATH: process.env.TMAP_TRANSIT_PATH || '/routes/transit',
-  // ...
-}
+export const ENV = {
+  /** CAR (자동차) **/
+  TMAP_CAR_BASE_URL: process.env.TMAP_CAR_BASE_URL || 'https://apis.openapi.sk.com/tmap',
+  TMAP_CAR_PATH: process.env.TMAP_CAR_PATH || '/routes',
+
+  /** TRANSIT (대중교통) **/
+  TMAP_TRANSIT_BASE_URL: process.env.TMAP_TRANSIT_BASE_URL || 'https://apis.openapi.sk.com/transit',
+  TMAP_TRANSIT_PATH: process.env.TMAP_TRANSIT_PATH || '/routes',
+
+  /** Common **/
+  TMAP_API_KEY: process.env.TMAP_API_KEY!,
+  // ... keep existing keys
+};
```

**Also update** `server/env.example` accordingly:

```diff
-# Car + Transit (old)
-TMAP_BASE_URL=https://apis.openapi.sk.com/tmap
-TMAP_CAR_PATH=/routes
-TMAP_TRANSIT_PATH=/routes/transit
+## Car
+TMAP_CAR_BASE_URL=https://apis.openapi.sk.com/tmap
+TMAP_CAR_PATH=/routes
+
+## Transit
+TMAP_TRANSIT_BASE_URL=https://apis.openapi.sk.com/transit
+TMAP_TRANSIT_PATH=/routes
```

### 1.2 Optional helper (keeps callsites tidy)

**`server/src/lib/http.ts`** (if not present, you can inline in adapter):

```ts
export function joinUrl(base: string, path: string) {
  const b = base.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}
```

---

## 2) Server — TMAP Adapter: Correct the Transit Call

### 2.1 File header constants & URL builder

**`server/src/adapters/tmap.adapter.ts`**

```diff
-const DEFAULT_TMAP_BASE_URL = 'https://apis.openapi.sk.com/tmap';
+const DEFAULT_TMAP_CAR_BASE_URL = 'https://apis.openapi.sk.com/tmap';
+const DEFAULT_TMAP_TRANSIT_BASE_URL = 'https://apis.openapi.sk.com/transit';

-function buildTmapUrl(path: string) {
-  const base = (ENV.TMAP_BASE_URL || DEFAULT_TMAP_BASE_URL).replace(/\/$/, '');
-  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
-}
+function buildUrl(kind: 'car' | 'transit', path: string) {
+  const base =
+    kind === 'transit'
+      ? (ENV.TMAP_TRANSIT_BASE_URL || DEFAULT_TMAP_TRANSIT_BASE_URL)
+      : (ENV.TMAP_CAR_BASE_URL || DEFAULT_TMAP_CAR_BASE_URL);
+  const trimmed = base.replace(/\/$/, '');
+  return `${trimmed}${path.startsWith('/') ? path : `/${path}`}`;
+}
```

### 2.2 Parameter builder — `searchDttm` instead of `departure_time`

Add/replace a transit param builder:

```ts
function formatTransitTime(d: Date): string {
  // yyyymmddhhmi (minutes)
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}${mm}${dd}${hh}${mi}`;
}

export type TransitParams = {
  startX: string; // lon
  startY: string; // lat
  endX: string;   // lon
  endY: string;   // lat
  format?: 'json' | 'xml';
  lang?: 0 | 1;
  count?: number; // 1..10
  searchDttm?: string; // yyyymmddhhmi
};

function buildTransitParams(from: { lat: number; lon: number }, to: { lat: number; lon: number }, when?: Date): TransitParams {
  const params: TransitParams = {
    startX: String(from.lon),
    startY: String(from.lat),
    endX: String(to.lon),
    endY: String(to.lat),
    format: 'json',
    lang: 0,
    count: 1,
  };
  if (when) params.searchDttm = formatTransitTime(when);
  return params;
}
```

> **Note**: Do **not** send `reqCoordType` / `resCoordType` for Transit. Keep them for **car** routes only if your car implementation needs them.

### 2.3 Make the actual POST call

Replace the incorrect GET to `/routes/transit` under car base with a **POST** to `/routes` under transit base:

```diff
-const params = buildTransitParams(from, to, when);
-const res = await http.get(
-  buildTmapUrl(ENV.TMAP_TRANSIT_PATH || '/routes/transit'),
-  {
-    headers: { appKey: ENV.TMAP_API_KEY, Accept: 'application/json' },
-    params,
-  }
-);
+const body = buildTransitParams(from, to, when);
+const res = await http.post(
+  buildUrl('transit', ENV.TMAP_TRANSIT_PATH || '/routes'),
+  body,
+  { headers: { appKey: ENV.TMAP_API_KEY, Accept: 'application/json' } }
+);
```

### 2.4 Parsing (ETA minutes)

Tmap Transit response places itineraries under `plan.itineraries[]`, with `totalTime` in **seconds**. Parse into your `TrafficBrief` shape:

```ts
export type TrafficBrief = {
  mode: 'car' | 'transit';
  eta_minutes: number | null;
  // ...existing fields
};

function parseTransitBrief(json: any): TrafficBrief {
  const sec = json?.plan?.itineraries?.[0]?.totalTime;
  const eta = typeof sec === 'number' ? Math.round(sec / 60) : null;
  return { mode: 'transit', eta_minutes: eta };
}
```

Wire this into your adapter’s exported surface, e.g. `getTransitRoute(...)` returns `{ brief, raw }`.

---

## 3) Server — City Aggregator & Recommendation

You likely already have `/traffic/city`. Ensure it:

1. **Fetches car + transit in parallel**.
2. **Attaches tollgates** to the **car** brief (existing 200 m buffer match + KEC congestion lookup).
3. **Computes recommendation** (`car` | `transit` | `tie`) and returns it with both briefs.

### 3.1 Service skeleton

**`server/src/services/traffic.service.ts`** (essential parts only)

```ts
export type CityTraffic = {
  car: TrafficBrief & { tollgates?: TrafficTollgate[] } | null;
  transit: TrafficBrief | null;
  recommendation: { mode: 'car' | 'transit' | 'tie'; reason?: string };
};

export async function getCityTraffic(opts: { from: Coords; to: Coords; when?: Date }) {
  const { from, to, when } = opts;
  const [car, transit] = await Promise.all([
    tmap.getCarRoute(from, to, when),
    tmap.getTransitRoute(from, to, when),
  ]);

  // Attach tollgates to car brief (keep your existing 200m matcher)
  const carWithToll = car?.brief ? {
    ...car.brief,
    tollgates: await getRouteTollgates(car),
  } : null;

  const recommendation = recommend(carWithToll?.eta_minutes ?? null, transit?.brief?.eta_minutes ?? null);

  return {
    car: carWithToll,
    transit: transit?.brief ?? null,
    recommendation,
  } satisfies CityTraffic;
}

function recommend(carMin: number | null, trMin: number | null): CityTraffic['recommendation'] {
  if (carMin == null && trMin == null) return { mode: 'tie', reason: 'no data' };
  if (carMin == null) return { mode: 'transit', reason: 'car missing' };
  if (trMin == null) return { mode: 'car', reason: 'transit missing' };
  const diff = carMin - trMin; // positive → transit faster
  const TIE = 3; // minutes threshold for practical tie (tune as you like)
  if (Math.abs(diff) <= TIE) return { mode: 'tie', reason: 'within tie margin' };
  return diff > 0 ? { mode: 'transit', reason: `transit faster by ${diff}m` } : { mode: 'car', reason: `car faster by ${-diff}m` };
}
```

### 3.2 Route handler

**`server/src/routes/traffic.routes.ts`** (ensure the aggregator is exported)

```ts
router.get('/city', async (req, res, next) => {
  try {
    const { from, to } = await parseQuery(req.query); // your existing geocoding helper
    const when = req.query.when ? new Date(String(req.query.when)) : undefined;
    const data = await trafficService.getCityTraffic({ from, to, when });
    res.json({ ok: true, data });
  } catch (e) {
    next(e);
  }
});
```

> **Tollgates**: Keep your existing 200 m buffer matcher and KEC plaza congestion fetch. No code change required here.

---

## 4) Frontend — Always Use `/traffic/city`, and Branch the UI

### 4.1 Data fetch

**`src/pages/TravelPage.tsx`** (key parts only)

```diff
- if (mode === 'car') {
-   const car = await fetchCar({ from: fromParam, to: toParam, signal });
-   // ...
- } else {
-   const city = await fetchCity({ from: fromParam, to: toParam, signal });
-   // ...
- }
+ const city = await fetchCity({ from: fromParam, to: toParam, signal });
+ if (cancelled) return;
+ setCarBrief(city.car ?? null);
+ setTransitBrief(city.transit ?? null);
+ setRecommendation(city.recommendation ?? null);
```

### 4.2 Branching logic (two cases)

```ts
const isTie = recommendation?.mode === 'tie';
const mismatch = !!recommendation?.mode && !isTie && recommendation.mode !== mode; // preferred ≠ recommended
```

**Render**

```tsx
{/* Case 2: preferred ≠ recommended → compare card + recommendation banner */}
{mismatch && (
  <>
    <RecommendationBanner
      preferred={mode}
      recommended={recommendation!.mode}
      carEtaMinutes={carBrief?.eta_minutes ?? null}
      transitEtaMinutes={transitBrief?.eta_minutes ?? null}
      reason={recommendation?.reason}
    />
    <EtaCompareCard
      car={carBrief || undefined}
      transit={transitBrief || undefined}
      selected={mode}
      onSelect={setMode}
      recommended={recommendation?.mode}
      loading={loading}
    />
  </>
)}

{/* Case 1: preferred = recommended OR tie → single card only */}
{!mismatch && mode === 'car' && carBrief && (
  <CarEtaCard brief={carBrief} />
)}
{!mismatch && mode === 'transit' && transitBrief && (
  <TransitEtaCard brief={transitBrief} />
)}

{/* Tollgates visible only when car card is active */}
{mode === 'car' && carBrief?.tollgates?.length ? (
  <TollgatePanel tollgates={carBrief.tollgates} />
) : null}
```

### 4.3 “Brief me” button → route with preferred mode

Your existing `SearchForm` already emits `from`, `to`, and `mode`. On submit, navigate to the Travel page with `?from=...&to=...&mode=car|transit` so that the page knows the user’s preferred mode (used only for **rendering**, not for which API to call).

---

## 5) API Contract (Server → UI)

**`GET /api/v1/traffic/city?from=...&to=...`**

```json
{
  "ok": true,
  "data": {
    "car": { "mode": "car", "eta_minutes": 32, "tollgates": [/* ... */] },
    "transit": { "mode": "transit", "eta_minutes": 28 },
    "recommendation": { "mode": "transit", "reason": "transit faster by 4m" }
  }
}
```

> **Note**: When car is active, show `TollgatePanel` using `data.car.tollgates` exactly as before.

---

## 6) Smoke Tests

### 6.1 Transit only (server relays to POST /transit/routes)

```bash
curl -X POST "http://localhost:8787/api/v1/traffic/transit" \
  --data-urlencode "from=서울특별시 중구 세종대로 110" \
  --data-urlencode "to=서울특별시 송파구 올림픽로 300"
```

Expect: `ok: true`, and `data.eta_minutes` filled from Transit (`plan.itineraries[0].totalTime / 60`).

### 6.2 City (car + transit + recommendation)

```bash
curl "http://localhost:8787/api/v1/traffic/city?from=서울특별시 중구 세종대로 110&to=서울특별시 송파구 올림픽로 300"
```

Expect: `data.car.tollgates` present (if polyline matched within 200 m buffer) + sensible recommendation.

### 6.3 Briefing

```bash
curl "http://localhost:8787/api/v1/briefing?from=서울특별시 중구 세종대로 110&to=서울특별시 송파구 올림픽로 300"
```

Expect: same traffic payload embedded in the briefing response your UI consumes.

---

## 7) Edge Cases & Resilience

* **429 / Quota** from Transit → surface `sourceStatus='degraded'` and keep car data; recommendation can still prefer car.
* **No itineraries** → set `transit.eta_minutes = null`, recommendation will bias to car or tie.
* **Polyline missing** (rare) → `tollgates=[]` (not an error). Keep rendering logic unchanged.
* **App Key / Product not enabled** → Transit will 403/404; treat as degraded and log actionable error.

---

## 8) Ops & ENV Checklist

* `TMAP_TRANSIT_BASE_URL=https://apis.openapi.sk.com/transit`
* `TMAP_TRANSIT_PATH=/routes`
* `Accept: application/json`
* `searchDttm=YYYYMMDDHHmm` when scheduling in the future (optional)
* Ensure your SK Open API **App** has the **TMAP 대중교통** product added (Transit) in addition to the Car APIs.

---

## 9) FAQ

**Q. Do we still keep tollgate congestion exactly as‑is?**
A. Yes. The city aggregator attaches `tollgates` only to the **car** brief. UI shows the panel whenever **car** is the active card. No change to the 200 m matcher or KEC fetch.

**Q. Why always call `/traffic/city` from the UI?**
A. It guarantees both ETAs and keeps `tollgates` available for car. It also enables symmetric compare UX regardless of the preferred mode.

**Q. What about `reqCoordType`/`resCoordType`?**
A. These are relevant for **car** routes. For Transit, follow the minimal spec above; do not send those keys unless Tmap requires them later.

---

## 10) Minimal Patch Set (copy list into PR)

* `server/src/lib/env.ts` — split car/transit bases; add keys.
* `server/env.example` — reflect new keys.
* `server/src/adapters/tmap.adapter.ts` — new `buildUrl('transit', ...)`, `buildTransitParams(...)`, **POST** to `/transit/routes`, parser to minutes.
* `server/src/services/traffic.service.ts` — ensure parallel car+transit + tollgates + recommendation.
* `server/src/routes/traffic.routes.ts` — expose `/city` (and `/transit` if you provide a direct endpoint for debugging).
* `src/pages/TravelPage.tsx` — always `fetchCity`, branch UI, keep `TollgatePanel` under car.

> After this patch, the original transit URL/method/param mistakes are eliminated, briefing works off `/traffic/city`, and the tollgate congestion feature is fully preserved.
