# CWS — Tollgate Congestion Overlay Implementation Guide (Updated)

*Goal:* Show **tollgate congestion along the actual TMAP route** in the UI, while satisfying the requirement to **use KEC (Korea Expressway Corp.) APIs**. For now we ship with a **small sample** `expressway_tollgates.json`. Later, replace with the full nationwide master.

**Status:** Data Portal is temporarily down → proceed with sample data + full wiring. This doc is developer‑oriented, step‑by‑step, and safe to implement without breaking current features.

> **Compatibility Note (new):** This updated guide preserves current repository behavior (MOCK/fail‑open) and adds **explicit compatibility rules** for the tollgate JSON format, **precise TMAP geometry mapping rules**, and **KEC outage behavior** so the feature is fully implementable now with mock/null values, and drops into live KEC data later with no breaking changes.

---

## 0) High‑level Architecture

1. **User inputs** origin/destination (address or lat/lon).
2. **Geocoding** → lat/lon (existing TMAP geocoder and current health endpoints).
3. **Get TMAP car route** with **GeoJSON geometry** (LineString + Points).
4. **Spatial matching**: Find tollgates from `expressway_tollgates.json` that lie **along** (or within a small buffer from) the route polyline.
5. **KEC APIs**: For matched tollgates, fetch **congestion/traffic metrics** (e.g., per‑plaza traffic, or plaza‑to‑plaza travel time as fallback).
6. **UI**: Display badges for each encountered tollgate with status (e.g., *Smooth / Slow / Heavy*), and a detail drawer with timestamps and raw values.
7. **Fallback**: If no tollgate matched → use current logic (nearest start/end tollgate pair; KEC unit travel time), and still show an informational line in the UI.

---

## 1) Data Contract (Local Tollgate Master)

**File:** `server/data/expressway_tollgates.json`

```json
{
  "tollgates": [
    {
      "id": "TBD001",
      "name": "Seoul",
      "lat": 37.566,
      "lon": 126.978,
      "routeNo": "100",
      "routeName": "Seoul Beltway"
    },
    {
      "id": "TBD002",
      "name": "Pangyo",
      "lat": 37.402,
      "lon": 127.113,
      "routeNo": "100",
      "routeName": "Seoul Beltway"
    },
    {
      "id": "TBD003",
      "name": "Icheon",
      "lat": 37.263,
      "lon": 127.442,
      "routeNo": "50",
      "routeName": "Yeongdong Expy"
    }
  ],
  "source": "KEC data.ex.co.kr + data.go.kr (to be replaced with official nationwide master)",
  "version": "2025-10-09-sample"
}
```

### Notes

* `id` **MUST** ultimately be the **official KEC toll plaza code** when the full dataset is ready. For now, keep placeholders (e.g., `TBDxxx`).
* Coordinates are **WGS84**. Store as **decimal degrees**.
* Extendable fields allowed (e.g., `city`, `direction`, `rampType`). Keep the above minimal set stable.

> **Schema Compatibility (new & important):** The loader **MUST accept both** of the following JSON root shapes to avoid breaking existing code:
>
> * **Shape A (current repo default):** Array root — `[{ id, name, lat, lon, ... }]`
> * **Shape B (preferred going forward):** Object root — `{ tollgates: Tollgate[], source?: string, version?: string }`
>
> **Loader rule:** If the parsed JSON has a `tollgates` array, use it. Otherwise, treat the entire JSON as an array of tollgates. This lets us switch to the richer object root without breaking earlier readers.

---

## 2) TMAP Route Geometry Contract

* Expect **GeoJSON FeatureCollection** in the adapter result where:

  * Route path is one or multiple **`LineString`** features (`geometry.coordinates = [[lon,lat], ...]`).
  * Key points (start, end, via, guidance) are **`Point`** features.
* Coordinate order: `[lon, lat]`.
* Not guaranteed to be uniformly sampled; treat as a polyline.

> **Geometry Mapping Rules (new & precise):** When `includeGeometry: true` is passed to the TMAP adapter:
>
> 1. **FeatureCollection:** Return `{ type: 'FeatureCollection', features: [...] }`.
> 2. **LineString:**
>
>    * Build **one merged LineString** by concatenating the route’s polyline segments in order.
>    * Source of coordinates:
>
>      * Prefer any explicit **line/polyline arrays** in the TMAP route response (e.g., section/path/lineString‑like fields), **preserving order**.
>      * Normalize to **WGS84** and **`[lon, lat]`**.
>      * If multiple sub‑polylines exist, append sequentially; do **not** resample/simplify.
> 3. **Points:** Emit at least two `Point` features for **origin** and **destination** using the resolved coordinates; via/guidance points are optional.
> 4. **Back‑compat:** When `includeGeometry` is **false** (default), keep the current summary‑only behavior.

---

## 3) New/Changed Server APIs

### 3.1 Public Route‑Tollgates Endpoint

**Route:** `GET /traffic/route-tollgates`

**Query params (either A or B):**

* **A. Addresses**

  * `fromAddr` (string)
  * `toAddr` (string)
* **B. Coordinates**

  * `fromLat`, `fromLon` (number)
  * `toLat`, `toLon` (number)
* Optional: `bufferMeters` (default 200), `maxTollgates` (default 12)

**Response (shape):**

```json
{
  "ok": true,
  "route": {
    "distanceMeters": 48213,
    "durationSeconds": 3120,
    "geometry": { "type": "FeatureCollection", "features": [/* LineString+Point */] }
  },
  "tollgates": [
    {
      "id": "TBD002",
      "name": "Pangyo",
      "lat": 37.402,
      "lon": 127.113,
      "routeNo": "100",
      "routeName": "Seoul Beltway",
      "distanceFromRouteMeters": 97,
      "progressRatio": 0.33,
      "kec": {
        "observedAt": "2025-10-09T12:34:56Z",
        "trafficVolume": 1320,
        "congestionLevel": "SLOW",
        "speedKph": 45,
        "source": "KEC plaza traffic API"
      }
    }
  ],
  "fallback": {"used": false, "reason": null}
}
```

> **KEC Outage Behavior (new):** If the KEC plaza API is unavailable or times out, **still return the matched tollgates**, but set `kec` to **`null`** or a **mocked object** with `source: "kec_unavailable" | "mock"`. The UI should render a neutral/gray badge in this case; see Caching & Resilience for timeouts and TTL.

### 3.2 Existing Fallback Endpoint (kept)

* `GET /traffic/expressway` (nearest start/end tollgates → KEC unit travel time). No change, used as a fallback strategy.

---

## 4) Code Changes by Layer

### 4.1 Adapter — TMAP (`server/src/adapters/tmap.adapter.ts`)

**Add:**

```ts
export interface GetCarRouteOptions {
  includeGeometry?: boolean; // default false (preserve old behavior)
}

export async function getCarRoute(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
  options: GetCarRouteOptions = {}
) {
  // 1) call TMAP API
  // 2) map common fields { totalTime, totalDistance }
  // 3) if (options.includeGeometry) attach raw GeoJSON FeatureCollection (see Section 2 rules)
  // 4) return normalized shape
}
```

**Backward compatibility:** keep old export or add a wrapper `getCarRouteSummary()` that calls `getCarRoute(..., { includeGeometry:false })`.

### 4.2 Util — Geometry & Matching (`server/src/lib/util.ts`)

Add helpers:

```ts
export function haversineMeters(a: {lat:number;lon:number}, b:{lat:number;lon:number}): number { /* ... */ }

export function pointToSegmentDistanceMeters(
  p: {lat:number;lon:number},
  a: {lat:number;lon:number},
  b: {lat:number;lon:number}
): number { /* equirectangular projection → perpendicular distance */ }

export function pointToPolylineDistanceMeters(
  p: {lat:number;lon:number},
  line: Array<{lat:number;lon:number}>
): {distance: number; atIndex: number} { /* iterate segments; track min */ }

export function sortByRouteProgress(
  line: Array<{lat:number;lon:number}>,
  candidates: Array<{lat:number;lon:number}>
): number[] { /* return indices sorted by nearest cumulative distance along line */ }

export function tollgatesAlongRoute(
  line: Array<{lat:number;lon:number}>,
  tollgates: Array<Tollgate>,
  bufferMeters = 200,
  max = 12
): Array<MatchedTollgate> { /* filter by distance<=buffer; dedupe by id; sort by progress */ }
```

**Types:**

```ts
export interface Tollgate { id:string; name:string; lat:number; lon:number; routeNo?:string; routeName?:string }
export interface MatchedTollgate extends Tollgate { distanceFromRouteMeters:number; progressRatio:number }
```

### 4.3 Adapter — KEC (`server/src/adapters/expressway.adapter.ts`)

Add plaza‑level getter (choose final API when portal is back):

```ts
export interface PlazaTraffic {
  observedAt: string; // ISO
  trafficVolume?: number;
  speedKph?: number;
  congestionLevel?: 'SMOOTH'|'SLOW'|'HEAVY'|'BLOCKED';
  source: string; // e.g., 'kec_plaza_api' | 'kec_unavailable' | 'mock'
}

export async function getPlazaTraffic(plazaId: string): Promise<PlazaTraffic | null> {
  // 1) call KEC plaza traffic API; map to PlazaTraffic
  // 2) On outage/timeout, return null OR a minimal object { observedAt: nowISO, source: 'kec_unavailable' }
}
```

> **Caching & Timeouts (new):**
>
> * **KEC plaza cache:** in‑memory LRU/TTL **30–60 s** keyed by `plazaId`.
> * **HTTP timeouts:** **2–4 s** per upstream.
> * **Retries:** single retry with jitter for transient 5xx.
> * **Outage behavior:** If both attempts fail within timeout budget, surface `kec: null` (or `source: 'kec_unavailable'`).

### 4.4 Service — Traffic (`server/src/services/traffic.service.ts`)

Add orchestrator:

```ts
export async function getRouteTollgates(params: RouteParams): Promise<RouteTollgatesResult> {
  // A) Resolve from/to to coordinates (geocode if needed)
  // B) getCarRoute(..., { includeGeometry:true })
  // C) extract LineString coordinates → [{lat,lon}]
  // D) read tollgates from server/data/expressway_tollgates.json (supports both root shapes; see Section 1)
  // E) match via tollgatesAlongRoute(line, tollgates, bufferMeters, max)
  // F) for each matched.id → getPlazaTraffic(id) with caching & timeouts
  // G) assemble response; set fallback.used=false
  // H) if matched.length==0 → run legacy nearest‑pair path and set fallback.used=true
}
```

### 4.5 Route — HTTP (`server/src/routes/traffic.routes.ts`)

Add:

```ts
router.get('/traffic/route-tollgates', async (req, res) => {
  // parse query
  // call getRouteTollgates
  // handle errors; map to {ok:false, error, message}
});
```

---

## 5) Caching, Timeouts, and Resilience

* **KEC API caching:** LRU/TTL (e.g., 30–60 s) in‑memory. Keyed by `plazaId`.
* **TMAP route cache:** optional (key by from/to rounded to 5–6 decimal places + options). TTL 30–60 s.
* **Timeouts:** HTTP client timeout 2–4 s per upstream; overall request budget 6–8 s.
* **Retries:** single retry with jitter for transient 5xx.
* **MOCK fallback:** Respect existing `MOCK=1` pathway: return deterministic sample payloads for demos and tests.

> **UI flagging (new):** When `kec` is `null` or `source==='kec_unavailable'`, the UI should render a neutral/gray state for the tollgate badge and show a tooltip like “KEC data currently unavailable”.

---

## 6) Matching Algorithm Details

**Distance model:**

* Use **equirectangular approximation** for speed; error is negligible within a few hundred meters.
* For point→segment distance: project to local plane around segment midpoint; clamp projection to segment extents.

**Buffer:**

* Default **`bufferMeters = 200`**. Increase to 300–400 m for urban interchanges with parallel ramps.

**Order (progressRatio):**

* Compute cumulative length along the polyline at the nearest segment index; divide by total length.

**Deduping:**

* If multiple candidate points for same `id`, keep the one with minimal distance.

**Performance:**

* If we keep ≤ 2–3k tollgates, naive O(N·M) with M≈#segments is fine (< few ms). Early exit for distance > 1000 m.

---

## 7) UI Integration (Minimal)

* **Route panel chips:** For each matched tollgate, show `name` + colored badge for `congestionLevel`. Tooltip with volume/speed and `observedAt`.
* **Map overlay:** optional later — draw small icons at matched positions (snapped to nearest route vertex index).
* **Empty state:** If `matched.length==0`, show info banner: “No tollgates detected on this route. Showing nearest‑pair estimate instead.”
* **Unavailable KEC:** If `kec===null` or `kec.source==='kec_unavailable'`, show a neutral badge and an informational tooltip.

---

## 8) Testing Plan

**Unit tests:**

* `pointToSegmentDistanceMeters`, `pointToPolylineDistanceMeters`, `tollgatesAlongRoute` (various shapes: straight, curve, fork; verify ordering & distances).

**Integration (MOCK):**

* Mock TMAP route (simple 10‑vertex polyline) and 3 tollgates; expect 2 matches within 200 m.
* Mock KEC plaza API (fixed payload) and verify mapping to `congestionLevel` thresholding.
* Add tests for **schema A/B loader** behavior and **KEC=unavailable** handling.

**Manual cURL:**

```bash
curl -G "http://localhost:8787/traffic/route-tollgates" \
  --data-urlencode "fromAddr=서울특별시 중구 세종대로 110" \
  --data-urlencode "toAddr=경기도 성남시 분당구 판교역로 235" \
  --data-urlencode "bufferMeters=200" \
  --data-urlencode "maxTollgates=12"
```

---

## 9) Env & Secrets

```
TMAP_API_KEY=***
EXPRESSWAY_API_KEY=***     # a.k.a. KEC key (preferred name in repo)
KEC_API_KEY=***            # optional alias; if both set, EXPRESSWAY_API_KEY takes precedence
MOCK=1                     # demo/dev default
HTTP_TIMEOUT_MS=3000
CACHE_TTL_KV_SECONDS=60
```

> **ENV Compatibility (new):** The server should read **`EXPRESSWAY_API_KEY`** first (current repo default) and fall back to **`KEC_API_KEY`** if unset. If your code already uses `EXPRESSWAY_BASE_URL`, keep it; otherwise, default to the standard KEC host.

---

## 10) Future: Replace Sample Data with Nationwide Master

When the portal is back:

1. **Download** KEC plaza master (CSV/Excel) with **official plaza codes**.
2. **Join** with **plaza coordinates** (OpenAPI or provided fields). Prefer code‑based join; fallback to name+route fuzzy.
3. **Export** `server/data/expressway_tollgates.json` in the schema above (either root shape is fine; object root recommended for metadata).
4. **Verify** by sampling 5–10 plaza IDs against KEC live APIs.

Optional helper script (Node):

```ts
// tools/build_tollgates_json.ts
// read CSV → clean fields → join coords → write expressway_tollgates.json
```

---

## 11) Error Mapping & Logging

* Map upstream errors to stable app codes: `kec_unavailable`, `kec_timeout`, `tmap_timeout`, `no_tollgates_matched`, `bad_request`.
* Log with structured fields: `{ routeId, from, to, bufferMeters, matchedCount, fallbackUsed }`.

---

## 12) Acceptance Criteria

* [ ] `GET /traffic/route-tollgates` returns `ok:true`, includes `route.geometry` and ≥0 `tollgates`.
* [ ] With sample JSON, a Pangyo‑passing route yields Pangyo in matches at buffer 200–300 m.
* [ ] On KEC outage, response still returns with `tollgates[*].kec===null` (or `{ source: 'kec_unavailable' }`) and `fallback.used=false`.
* [ ] If no tollgates matched, legacy nearest‑pair is invoked and `fallback.used=true`.
* [ ] Loader accepts **both** tollgate JSON root shapes (array root or `{ tollgates: [...] }`).
* [ ] No breaking changes to existing endpoints; unit tests cover core geometry utils and outage handling.

---

## 13) Risk & Mitigation

* **Data mismatches (names/codes):** Enforce code‑based joins; maintain a small manual alias map for edge cases.
* **Geometry drift:** Increase buffer; snap to nearest vertex; optionally resample polyline every ~50–100 m (future).
* **Rate limits/latency:** Add caching, timeouts, and minimal retries with jitter.
* **KEC availability:** Ensure graceful `kec=null` + clear UI state; record `kec_unavailable` counts in logs for SLOs.

---

### Done is better than perfect.

Ship the route‑overlay with sample plazas today; swap in the nationwide master as soon as it’s available.
