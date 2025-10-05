# Codex Task — Plan B (No network to vendor docs)

## What you will do now
1) **Stub adapters** for TMAP (car/transit) and Korea Expressway (tollgate travel time).
2) Implement **parsers** against local JSON fixtures (provided in `./fixtures`).
3) Implement **services/routes/recommendation** using the normalized types.
4) Leave **HTTP call layers** behind TODO comments to be filled once official docs/links are supplied.

## Repo context
- Backend: `server/` (Express + TS). Use existing `lib/http.ts`, `lib/cache.ts`, `lib/logger.ts`, `lib/env.ts`.
- New files to add:
  - `server/src/adapters/tmap.adapter.ts`
  - `server/src/adapters/expressway.adapter.ts`
  - `server/src/services/traffic.service.ts` (extend)
  - `server/src/services/recommend.service.ts` (new)
  - `server/src/services/profile.service.ts` + `server/src/routes/profile.routes.ts` (new)
  - `server/src/routes/traffic.routes.ts` (extend)
  - `server/src/services/briefing.service.ts` (compose all)
  - `server/src/types/index.ts` (ensure types below)
  - `server/data/expressway_tollgates.json` (use the provided sample for now)

## Normalized Types (must exist)
- `Coordinates {lat:number; lon:number;}`
- `WeatherBrief`, `AirBrief`
- `TrafficMode = 'car'|'transit'|'bike'|'walk'`
- `TrafficBrief`:
  ```ts
  type TrafficBrief = {
    source: 'tmap'|'expressway';
    source_status: 'ok'|'missing_api_key'|'upstream_error'|'timeout'|'bad_response';
    updated_at: string;
    mode: 'car'|'transit'|'bike'|'walk';
    eta_minutes?: number;
    distance_km?: number;
    fare_krw?: number;
    transfers?: number;
    steps?: Array<{ type:'drive'|'metro'|'bus'|'walk'|'bike'; name?:string; duration_min?:number }>;
    congestion_level?: 'LOW'|'MID'|'HIGH';
    notes?: string[];
  }
  ```
- `Recommendation` and `Briefing` as previously specified by the user.

## Adapters — implement now (fixture-first)
- `TmapAdapter`:
  - `routeCar(from,to,when?)` → parse `fixtures/tmap_car.sample.json` and return a `TrafficBrief` with `mode:'car'`.
  - `routeTransit(from,to,when?)` → parse `fixtures/tmap_transit.sample.json` with `mode:'transit'`.
  - TODO: where to call real TMAP endpoints, env header `TMAP_API_KEY`, cache key `tmap:${mode}:${fromLat},${fromLon}:${toLat},${toLon}:${bucket5m}`.
- `ExpresswayAdapter`:
  - `routeExpresswayByTollgate(fromToll,toToll,when?)` → parse `fixtures/expressway_tollgate.sample.json` to `TrafficBrief` with `mode:'car'`, set `source:'expressway'`.
  - Use `server/data/expressway_tollgates.json` (copy the provided sample) and add util `nearestTollgate(lat,lon)` in `lib/util.ts`.
  - Map `trafficStatus/avgSpeed` → `congestion_level` ('LOW'|'MID'|'HIGH') heuristically.

## Services
- `TrafficService`:
  - `getCityTraffic(from,to,{when,modes})` → `{car?,transit?,walk?}` using `TmapAdapter`. (walk/bike can be heuristic)
  - `getExpresswayTraffic(from,to,{when})` → `{expressway?, meta:{fromToll,toToll}}` using `nearestTollgate` and `ExpresswayAdapter`.
- `RecommendService`:
  - Input: `{car?,transit?,expressway?,pop?,preferred}`; implement v1 rules (ETA gap ≥5–8min → suggest faster; POP≥0.6 → bias transit; +10 min → leave_earlier_min=10).
- `BriefingService`:
  - Compose weather/air/traffic city+expressway in parallel; produce `summary` and `notices[]`.

## Routes
- `GET /api/v1/traffic/car|/transit?from=lat,lon&to=lat,lon&time=iso`
- `GET /api/v1/traffic/expressway?from=lat,lon&to=lat,lon&time=iso`
- `POST /api/v1/profile`, `GET /api/v1/profile?user_id=...`
- `GET /api/v1/briefing?user_id=... [&from=lat,lon&to=lat,lon]`

## Tests
- Unit tests parse the fixtures and assert normalized fields.
- E2E: `/briefing` returns partial data with `notices[]` on simulated upstream failures.

## Definition of Done (Plan B)
- Build/tests pass with fixtures.
- `/api/v1/briefing` returns JSON including `traffic.car`, `traffic.transit`, `traffic.expressway`, and `recommendation`.
- Clear TODO comments indicate where to replace fixtures with real HTTP calls once the official docs are available.
