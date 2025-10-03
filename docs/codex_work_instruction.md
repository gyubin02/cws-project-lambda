

# ✅ Codex CLI Work Instruction Prompt 

> ## System / Repo Context
>
> * Monorepo: `cws-project/`
> * Backend: `server/` (Express + TypeScript, adapters/services/routes/lib/types).
> * Frontend: React/Vite/TS (already present).
> * All external API keys are **server-side only** in `.env`. The frontend only calls `/api/v1/*`.
> * Current repo already has weather (KMA), air (AirKorea), expressway (draft), briefing scaffold, and a MOCK mode.

> ## Goal
>
> Fully implement the **commute briefing** by integrating **four sources**: **TMAP** (city routing/ETA), **Korea Expressway** (highway ETA), **KMA** (weather), and **AirKorea** (air quality).
> Requirements:
>
> * User **profile** with home/work and preferred mode (car|transit).
> * **TMAP** for city ETA (car & transit).
> * **Expressway** for **highway** ETA (tollgate↔tollgate).
> * Strengthen **KMA** (Short-Term Forecast 2.0 parsing) and **AirKorea** (PM10/PM2.5 grade & advice).
> * **Recommendations** like “Leave 10 minutes earlier” or “Consider subway”.

> ## External APIs (Search & Verify REQUIRED)
>
> Use Codex’s **search** capabilities to find the official docs and reflect the **exact parameters & response schemas**. Leave a code comment with the **doc title/URL** you used.
>
> * **TMAP Mobility Open API**
>
>   * Car routing/ETA, Transit routing/summary (fare/transfers), optional walking.
>   * Search hints: `TMAP directions API`, `TMAP transit summary API`.
> * **Korea Expressway OpenAPI (data.ex.co.kr)**
>
>   * e.g., `tollgateTravelTime` (tollgate-to-tollgate travel time), plus realtime flow/works/incidents for notes.
>   * Search hints: `data.ex.co.kr OpenAPI`, `한국도로공사 tollgateTravelTime`.
> * **KMA Short-Term Forecast 2.0** (data.go.kr) — SKY/PTY/TMX/TMN/POP, UltraSrt/VilageFcst.
> * **AirKorea** (data.go.kr) — realtime PM10/PM2.5 by city/station, grade mapping.

> ## .env (update `server/env.example`)
>
> ```
> NODE_ENV=development
> PORT=8787
> CORS_ORIGINS=http://localhost:5173
> MOCK=0
>
> KMA_SERVICE_KEY=...
> AIRKOREA_SERVICE_KEY=...
> EXPRESSWAY_API_KEY=...      # ★ required
> TMAP_API_KEY=...            # ★ required
>
> HTTP_TIMEOUT_MS=4500
> HTTP_RETRY=1
> CACHE_TTL_SEC=300           # 5 min cache
> USER_PREFS_TTL_SEC=3600
> RATE_LIMIT_WINDOW_MS=60000
> RATE_LIMIT_MAX=120
> ```
>
> **Do not commit** any keys/secrets.

> ## Coding Rules
>
> * TypeScript strict; avoid `any`.
> * Reuse existing `lib/http.ts`, `lib/cache.ts`, `lib/logger.ts`, `lib/env.ts`.
> * All new endpoints under `/api/v1/*` with `zod` validation.
> * Keep existing naming/folder patterns (paths below are fixed).

> ## Types (unified normalized schema)
>
> Ensure/extend these in `server/src/types/index.ts`:
>
> * `Coordinates { lat, lon }`
> * `WeatherBrief`, `AirBrief`
> * `TrafficMode = 'car' | 'transit' | 'bike' | 'walk'`
> * `TrafficBrief` (source, source_status, mode, eta_minutes, distance_km, fare_krw, transfers, steps[], congestion_level, notes[])
> * `Recommendation` (headline, details[], suggested_mode?, leave_earlier_min?)
> * `Briefing` (weather, air, traffic: { car?, transit?, expressway? }, recommendation, summary, notices[])
> * `UserProfile` (user_id, home{lat,lon,label?,district?}, work{lat,lon,label?}, preferred_mode, tz, last_updated)

> ## Tasks (do in order)
>
> ### 1) Add TMAP adapter — `server/src/adapters/tmap.adapter.ts`
>
> * Class `TmapAdapter`:
>
>   ```ts
>   routeCar(from: Coordinates, to: Coordinates, when?: Date): Promise<TrafficBrief>
>   routeTransit(from: Coordinates, to: Coordinates, when?: Date): Promise<TrafficBrief>
>   // (optional) routeWalk(...)
>   ```
> * Read `TMAP_API_KEY` from env; set required headers.
> * **Search & verify** the correct endpoints and required params (origin/destination coords, depart time, etc.).
> * **Parse**: ETA (minutes), distance (km); for **transit** include fare and transfers and step list (subway/bus/walk); for **car** map any congestion-like indicator to `congestion_level` if available.
> * **Cache**: key `tmap:${mode}:${fromLat},${fromLon}:${toLat},${toLon}:${timeBucket5m}` with TTL `CACHE_TTL_SEC`.
> * **Error mapping**: `missing_api_key | timeout | upstream_error | bad_response`.

> ### 2) Strengthen Expressway adapter — `server/src/adapters/expressway.adapter.ts`
>
> * **Search the official Korea Expressway docs** and correct any placeholder params to match the spec.
> * Methods:
>
>   ```ts
>   routeExpresswayByTollgate(fromToll: string, toToll: string, when?: Date): Promise<TrafficBrief>
>   ```
> * **Coordinate → tollgate mapping**:
>
>   * Add `server/data/expressway_tollgates.json` with `{ id, name, lat, lon }[]`.
>   * In `lib/util.ts`, add `nearestTollgate(lat, lon): { id, name, lat, lon }`.
> * **Parse**: travel time → `eta_minutes`; map average speed/congestion into `congestion_level` (`LOW|MID|HIGH`).
> * If works/incidents endpoints exist, append human-friendly notes to `notes[]`.
> * Apply the same **cache** and **error mapping** as TMAP.

> ### 3) Weather (KMA) — `server/src/adapters/kma.adapter.ts`, `server/src/services/weather.service.ts`
>
> * Implement parsing for **SKY/PTY/TMX/TMN/POP** from UltraSrt/VilageFcst.
> * Compute **feels_like** (T, RH, wind).
> * Provide `hourly[6–12]`.
> * Use `latLonToGrid` and adjust `base_date/base_time` to KMA publication rules.

> ### 4) Air (AirKorea) — `server/src/adapters/airkorea.adapter.ts`, `server/src/services/air.service.ts`
>
> * Add `server/data/airkorea_stations.json` to map `lat/lon → district/station`.
> * Pick the latest observation row; extract `pm10/pm25`; compute **grade** (`good|normal|bad|verybad`) and `advice`.

> ### 5) Traffic service integration — `server/src/services/traffic.service.ts`
>
> * Signatures:
>
>   ```ts
>   getCityTraffic(from: Coordinates, to: Coordinates, opts: { when?: Date, modes?: TrafficMode[] }):
>     Promise<{ car?: TrafficBrief; transit?: TrafficBrief; walk?: TrafficBrief; }>
>
>   getExpresswayTraffic(from: Coordinates, to: Coordinates, opts: { when?: Date }):
>     Promise<{ expressway?: TrafficBrief; meta?: { fromToll: string; toToll: string } }>
>   ```
> * `getExpresswayTraffic` must use `nearestTollgate` for both ends, then call `routeExpresswayByTollgate`.

> ### 6) Recommendations — add `server/src/services/recommend.service.ts`
>
> * Input: `{ car?, transit?, expressway?, pop?, preferred }`.
> * v1 rules:
>
>   * If ETA difference ≥ 5–8 minutes, suggest the faster mode (`suggested_mode`).
>   * If `POP ≥ 0.6`, bias toward transit (walking/umbrella inconvenience).
>   * If current ETA exceeds baseline by ≥ 10 minutes, set `leave_earlier_min = 10`.
>   * If expressway is valid and similar to car ETA, add a detail like “Highway route is comparable / may save time”.

> ### 7) User profile — `server/src/services/profile.service.ts`, `server/src/routes/profile.routes.ts`
>
> * Storage: `server/src/lib/store.ts` JSON-KV (easy to swap to DB later).
> * Routes:
>
>   * `POST /api/v1/profile` (user_id, home, work, preferred_mode, tz).
>   * `GET /api/v1/profile?user_id=...`.

> ### 8) Integrated briefing — `server/src/services/briefing.service.ts`, `server/src/routes/briefing.routes.ts`
>
> * Input: `GET /api/v1/briefing?user_id=... [&from=lat,lon&to=lat,lon]`.
> * Steps:
>
>   1. Load profile (if omitted, use query’s from/to; if neither provided → 400).
>   2. Fetch `weather` (home or Seoul) & `air` in parallel.
>   3. Call `getCityTraffic` (TMAP) **and** `getExpresswayTraffic` (Expressway) in parallel.
>   4. Build recommendation with `recommend.service` (consider preferred mode, POP, expressway).
>   5. Compose `summary`; put any failing sources into `notices[]` (`*_timeout`, `*_missing_api_key`).

> ### 9) Routes update — `server/src/routes/traffic.routes.ts`
>
> * `GET /api/v1/traffic/car|/transit?from=lat,lon&to=lat,lon&time=iso`.
> * `GET /api/v1/traffic/expressway?from=lat,lon&to=lat,lon&time=iso` (tollgates auto-snapped).

> ### 10) Caching / Limits / Quality
>
> * Same OD queries: **TMAP 2–5 min**, **Expressway 5–10 min**, **KMA/AirKorea 5–10 min** caches.
> * Global `express-rate-limit` (120 req / 60s).
> * Timeout `HTTP_TIMEOUT_MS=4500`, retry 1.
> * Include a requestId in logs (existing logger already supports this).

> ### 11) Tests (Supertest + unit)
>
> * **E2E**: `/briefing` happy path; also test that partial upstream failure still returns partial JSON with `notices[]`.
> * **Unit**:
>
>   * TMAP parsing (fixtures) → ETA/fare/transfers.
>   * Expressway parsing → `eta_minutes`/`congestion_level`.
>   * KMA POP/SKY/PTY and AirKorea grade computation.

> ### 12) OpenAPI & Docs
>
> * Update `server/openapi.yaml` for `/profile`, `/traffic/*`, `/briefing` with schemas/examples.
> * Update root `README.md` with run commands, `.env` sample, key precautions, cache/quotas.

> ## Definition of Done
>
> * `pnpm -C server build && pnpm -C server test` passes.
> * `GET /api/v1/briefing?user_id=...` returns:
>
>   * `traffic.car` (TMAP), `traffic.transit` (TMAP), and `traffic.expressway` (Expressway) populated as applicable.
>   * `recommendation.headline` like “Roads congested — transit is ~8m faster” or “Leave 10 minutes earlier”.
>   * When any source fails, JSON still returns **partial data** and `notices[]` explains the cause.
> * Average response ≤ 2s (max 4.5s). Cache hits for repeated OD queries within TTL.

> ## Commands to Run
>
> ```
> pnpm -C server i
> pnpm -C server build
> pnpm -C server test
> pnpm -C server dev
> ```
>
> You should see `Server listening on :8787` and `GET /api/v1/briefing ... 200` in the console.

---




