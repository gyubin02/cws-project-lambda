---

# Live REST Integration (Fail-Open Mock Fallback)

## 0) Executive Summary

* **Goal:** Keep `MOCK=1` as default so the app is always runnable. If valid API keys exist, each adapter **attempts live REST calls first**; on **any** live failure (timeout, 4xx/5xx, schema mismatch), it **falls back to fixtures/stubs** without breaking the UI.
* **Scope:**

  * **TMAP**: Car routing + full-text geocoding
  * **Korea Expressway**: Real-time **tollgate-to-tollgate** travel time
  * **KMA**: Ultra-short nowcast + Short-term forecast (v2.0)
  * **AirKorea**: Nearest station lookup + real-time air quality
* **Success:** With **only** `.env` keys set (no code edits), the server returns live data; without keys, current fixture behavior is unchanged.

---

## 1) Environment & Config Contract

Add these variables to `.env`:

```env
# Behavior flags
MOCK=1
REQUEST_TIMEOUT_MS=7000
RETRY_MAX_ATTEMPTS=2

# TMAP
TMAP_API_KEY=
TMAP_BASE_URL=https://apis.openapi.sk.com/tmap

# Korea Expressway
EXPRESSWAY_API_KEY=
EXPRESSWAY_BASE_URL=http://data.ex.co.kr/openapi/trtm

# KMA (Korea Meteorological Administration)
KMA_API_KEY=
KMA_BASE_URL=http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0

# AirKorea
AIRKOREA_API_KEY=
AIRKOREA_BASE_URL=http://apis.data.go.kr/B552584/ArpltnInforInqireSvc
```

**Boot validation**

* If `MOCK=1`: missing keys → **warn** only (non-fatal).
* If `MOCK=0`: missing required keys for the requested adapters → **fail fast** with a clear message.

---

## 2) Global Control Flow (applies to every adapter)

* **When `MOCK===1`**

  * **Keys present** → **try live** → on any error **fallback to fixture**.
  * **Keys absent** → return **fixture immediately**.
* **When `MOCK===0`**

  * **Try live** → on error **fallback to fixture** and **log a warning**.

**Retries & timeouts**

* Use `REQUEST_TIMEOUT_MS` for all outbound calls.
* For **idempotent GET** requests, allow up to `RETRY_MAX_ATTEMPTS` automatic retries (simple backoff).
* Do **not** retry 4xx auth/parameter errors.

---

## 3) HTTP & Utilities

### 3.1 Common wrapper — `server/src/lib/liveOrMock.ts`

```ts
import { ENV } from './env';
import { logger } from './logger';

type Fn<T> = () => Promise<T>;

export async function liveOrMock<T>(opts: {
  hasKeys: boolean;
  live: Fn<T>;
  mock: Fn<T>;
  adapter: string;
}): Promise<T> {
  const { hasKeys, live, mock, adapter } = opts;

  const tryLive = async () => {
    const t0 = Date.now();
    const out = await live();
    logger.info(`[${adapter}] live OK in ${Date.now() - t0}ms`);
    return out;
  };

  if (ENV.MOCK) {
    if (hasKeys) {
      try { return await tryLive(); }
      catch (e: any) {
        const msg = e?.response?.status
          ? `${e.response.status} ${e.response.statusText}`
          : (e?.message ?? String(e));
        logger.warn(`[${adapter}] live failed (MOCK=1) → fixture fallback. reason=${msg}`);
        return await mock();
      }
    }
    return await mock();
  }

  // MOCK=0
  try { return await tryLive(); }
  catch (e: any) {
    const msg = e?.response?.status
      ? `${e.response.status} ${e.response.statusText}`
      : (e?.message ?? String(e));
    logger.warn(`[${adapter}] live failed (MOCK=0) → fixture fallback. reason=${msg}`);
    return await mock();
  }
}
```

### 3.2 Axios wrapper — `server/src/lib/http.ts`

*(Skip if you already have one.)*

```ts
import axios from 'axios';
import { ENV } from './env';

export const http = axios.create({
  timeout: Number(ENV.REQUEST_TIMEOUT_MS ?? 7000),
});

http.interceptors.response.use(undefined, async (error) => {
  const cfg = error.config ?? {};
  const isGet = (cfg.method ?? 'get').toLowerCase() === 'get';
  const max = Number(ENV.RETRY_MAX_ATTEMPTS ?? 2);

  cfg.__retryCount = cfg.__retryCount ?? 0;
  const retriable =
    isGet &&
    !error.response && // network/timeout
    cfg.__retryCount < max;

  if (retriable) {
    cfg.__retryCount++;
    return http(cfg);
  }
  return Promise.reject(error);
});
```

---

## 4) API-by-API Contract & Implementation Plan

> **Important:** Endpoint paths/param names are case-sensitive. Use the exact names shown here. Always scrub secrets in logs.

### 4.1 TMAP — Car Routing & Full-text Geocoding

**Auth**

* Header: `appKey: ${TMAP_API_KEY}`

**Endpoints**

* **Car Route (POST)**: `${TMAP_BASE_URL}/routes?version=1`
  **Body (JSON):**

  * `startX` (lon, WGS84), `startY` (lat, WGS84)
  * `endX` (lon, WGS84), `endY` (lat, WGS84)
  * `reqCoordType: "WGS84GEO"`, `resCoordType: "WGS84GEO"`
* **Geocoding (GET)**: `${TMAP_BASE_URL}/geo/fullAddrGeo`
  **Query:** `address`, `coordType=WGS84GEO`

**Sample curl**

```bash
# Routing
curl -X POST "$TMAP_BASE_URL/routes?version=1" \
  -H "appKey: $TMAP_API_KEY" \
  -H "Content-Type: application/json" -H "Accept: application/json" \
  -d '{"startX":126.9778,"startY":37.5665,"endX":127.033,"endY":37.499,"reqCoordType":"WGS84GEO","resCoordType":"WGS84GEO"}'

# Geocoding
curl -G "$TMAP_BASE_URL/geo/fullAddrGeo" \
  -H "appKey: $TMAP_API_KEY" \
  --data-urlencode "address=서울 중구 을지로 65" \
  --data-urlencode "coordType=WGS84GEO"
```

**Mapping (normalize to internal types)**

| External                            | Type/Unit | Internal           | Transform           |
| ----------------------------------- | --------- | ------------------ | ------------------- |
| `properties.totalDistance`          | m         | `distanceKm`       | `/1000` (number)    |
| `properties.totalTime`              | sec       | `durationMin`      | `Math.ceil(sec/60)` |
| `features[].geometry.coordinates`   | polyline  | `steps[].polyline` | passthrough         |
| `features[].properties.description` | text      | `steps[].label`    | passthrough         |
| Geocode `lat`/`lon`                 | deg       | `lat`/`lon`        | number              |

**Adapter sketch — `server/src/adapters/tmap.adapter.ts`**

```ts
import { ENV } from '../lib/env';
import { liveOrMock } from '../lib/liveOrMock';
import { http } from '../lib/http';
import fs from 'fs/promises';
import path from 'path';

const FIX = path.join(__dirname, '../../fixtures');
type LatLng = { lat: number; lon: number };

export class TmapAdapter {
  async geocode(query: string) {
    return liveOrMock({
      adapter: 'TMAP',
      hasKeys: !!ENV.TMAP_API_KEY,
      live: async () => {
        const res = await http.get(`${ENV.TMAP_BASE_URL}/geo/fullAddrGeo`, {
          headers: { appKey: ENV.TMAP_API_KEY as string },
          params: { address: query, coordType: 'WGS84GEO' },
        });
        return mapTmapGeocode(res.data);
      },
      mock: async () => {
        const raw = await fs.readFile(path.join(FIX, 'tmap_geocode.sample.json'), 'utf-8');
        return mapTmapGeocode(JSON.parse(raw));
      },
    });
  }

  async carRoute(origin: LatLng, dest: LatLng) {
    return liveOrMock({
      adapter: 'TMAP',
      hasKeys: !!ENV.TMAP_API_KEY,
      live: async () => {
        const body = {
          startX: origin.lon, startY: origin.lat,
          endX: dest.lon, endY: dest.lat,
          reqCoordType: 'WGS84GEO', resCoordType: 'WGS84GEO',
        };
        const res = await http.post(`${ENV.TMAP_BASE_URL}/routes?version=1`, body, {
          headers: { appKey: ENV.TMAP_API_KEY as string },
        });
        return mapTmapRoute(res.data);
      },
      mock: async () => {
        const raw = await fs.readFile(path.join(FIX, 'tmap_car.sample.json'), 'utf-8');
        return mapTmapRoute(JSON.parse(raw));
      },
    });
  }
}

// Fill using real payload structure from TMAP
function mapTmapGeocode(p: any) { /* normalize to {lat, lon, address?} */ return p; }
function mapTmapRoute(p: any) { /* normalize to TrafficBrief & steps */ return p; }
```

---

### 4.2 Korea Expressway — Real-time Tollgate-to-Tollgate Travel Time

**Auth**

* Query param: `key=${EXPRESSWAY_API_KEY}` (URL-encoded).
* Common query: `type=json`

**Endpoint (GET)**

* `${EXPRESSWAY_BASE_URL}/realUnitTrtm`
  **Query:**

  * `iStartUnitCode` = start tollgate ID
  * `iEndUnitCode`   = end tollgate ID
  * Optional: `iStartEndStdTypeCode` (1 start-based / 2 end-based), `sumTmUnitTypeCode` (e.g., 1=5-minute bins)

**Sample curl**

```bash
curl -G "$EXPRESSWAY_BASE_URL/realUnitTrtm" \
  --data-urlencode "key=$EXPRESSWAY_API_KEY" \
  --data-urlencode "type=json" \
  --data-urlencode "iStartUnitCode=101" \
  --data-urlencode "iEndUnitCode=103"
```

**Mapping**

| External                                  | Type/Unit          | Internal     | Transform      |
| ----------------------------------------- | ------------------ | ------------ | -------------- |
| `list[0].timeAvg`                         | minutes            | `etaMinutes` | number         |
| `list[0].stndDate`, `stndHour`, `stndMin` | yyyymmdd / hh / mm | `observedAt` | compose to ISO |

**Adapter sketch — `server/src/adapters/expressway.adapter.ts`**

```ts
import { ENV } from '../lib/env';
import { liveOrMock } from '../lib/liveOrMock';
import { http } from '../lib/http';
import fs from 'fs/promises';
import path from 'path';

const FIX = path.join(__dirname, '../../fixtures');

export class ExpresswayAdapter {
  async travelTime(fromTollId: string, toTollId: string) {
    return liveOrMock({
      adapter: 'EXPRESSWAY',
      hasKeys: !!ENV.EXPRESSWAY_API_KEY,
      live: async () => {
        const res = await http.get(`${ENV.EXPRESSWAY_BASE_URL}/realUnitTrtm`, {
          params: {
            key: ENV.EXPRESSWAY_API_KEY,
            type: 'json',
            iStartUnitCode: fromTollId,
            iEndUnitCode: toTollId,
          },
        });
        return mapExpressway(res.data);
      },
      mock: async () => {
        const raw = await fs.readFile(path.join(FIX, 'expressway_tollgate.sample.json'), 'utf-8');
        return mapExpressway(JSON.parse(raw));
      },
    });
  }
}

function mapExpressway(p: any) { /* normalize to {etaMinutes, observedAt, ...} */ return p; }
```

---

### 4.3 KMA — Ultra-short Nowcast & Short-term Forecast (v2.0)

**Auth**

* Query: `serviceKey=${KMA_API_KEY}`, `dataType=JSON`

**Coordinate & time rules**

* Convert **WGS84 lat/lon → (nx, ny)** using **DFS grid**.
* **Ultra-short nowcast** (`getUltraSrtNcst`): choose the latest **on-the-hour** `base_time` not in the future.
* **Short-term forecast** (`getVilageFcst`): use the latest published slot among `02,05,08,11,14,17,20,23`. If the newest slot isn’t available yet, fall back to the previous slot.

**Endpoints (GET)**

* `${KMA_BASE_URL}/getUltraSrtNcst`
* `${KMA_BASE_URL}/getVilageFcst`

**Common Query**

* `serviceKey`, `base_date=YYYYMMDD`, `base_time=HHmm`, `nx`, `ny`, `dataType=JSON`

**Sample curl**

```bash
# Ultra nowcast
curl -G "$KMA_BASE_URL/getUltraSrtNcst" \
  --data-urlencode "serviceKey=$KMA_API_KEY" \
  --data-urlencode "base_date=20251004" \
  --data-urlencode "base_time=1400" \
  --data-urlencode "nx=60" \
  --data-urlencode "ny=127" \
  --data-urlencode "dataType=JSON"

# Short-term forecast
curl -G "$KMA_BASE_URL/getVilageFcst" \
  --data-urlencode "serviceKey=$KMA_API_KEY" \
  --data-urlencode "base_date=20251004" \
  --data-urlencode "base_time=1400" \
  --data-urlencode "nx=60" \
  --data-urlencode "ny=127" \
  --data-urlencode "dataType=JSON"
```

**Mapping (category → internal)**

| KMA `category` | Meaning          | Internal field      | Transform/Notes                           |
| -------------- | ---------------- | ------------------- | ----------------------------------------- |
| `T1H`/`TMP`    | Temperature (℃)  | `temperature`       | number                                    |
| `REH`          | Humidity (%)     | `humidity`          | number                                    |
| `SKY`          | Sky (1/3/4)      | `skyCode`           | pass code; map to text if needed          |
| `PTY`          | Precip type      | `precipType`        | 0 none, 1 rain, 2 sleet, 3 snow, 4 shower |
| `RN1`/`PCP`    | Precip amount    | `precipMm`          | `"강수없음"` → 0; else numeric mm             |
| `WSD`          | Wind speed (m/s) | `windSpeed`         | number                                    |
| `VEC`          | Wind dir (°)     | `windDegree`        | number                                    |
| `TMN`/`TMX`    | Min/Max temp (℃) | `minTemp`/`maxTemp` | number                                    |

**Adapter sketch — `server/src/adapters/kma.adapter.ts`**

```ts
import { ENV } from '../lib/env';
import { liveOrMock } from '../lib/liveOrMock';
import { http } from '../lib/http';
import fs from 'fs/promises';
import path from 'path';
import { latLonToGrid, selectBaseSlots, mergeUltraAndVillage } from '../lib/kma.util';

const FIX = path.join(__dirname, '../../fixtures');

export class KmaAdapter {
  async shortTerm(lat: number, lon: number, when: Date) {
    const { nx, ny } = latLonToGrid(lat, lon);
    const { base_date, ultra_base_time, village_base_time } = selectBaseSlots(when);

    return liveOrMock({
      adapter: 'KMA',
      hasKeys: !!ENV.KMA_API_KEY,
      live: async () => {
        const ultra = await http.get(`${ENV.KMA_BASE_URL}/getUltraSrtNcst`, {
          params: { serviceKey: ENV.KMA_API_KEY, base_date, base_time: ultra_base_time, nx, ny, dataType: 'JSON' },
        });
        const village = await http.get(`${ENV.KMA_BASE_URL}/getVilageFcst`, {
          params: { serviceKey: ENV.KMA_API_KEY, base_date, base_time: village_base_time, nx, ny, dataType: 'JSON' },
        });
        return mergeUltraAndVillage(ultra.data, village.data);
      },
      mock: async () => {
        const ultra = JSON.parse(await fs.readFile(path.join(FIX, 'kma_ultra.sample.json'), 'utf-8'));
        const village = JSON.parse(await fs.readFile(path.join(FIX, 'kma_village.sample.json'), 'utf-8'));
        return mergeUltraAndVillage(ultra, village);
      },
    });
  }
}
```

> Implement `latLonToGrid`, `selectBaseSlots`, and `mergeUltraAndVillage` in `server/src/lib/kma.util.ts`. Keep transforms deterministic and null-safe.

---

### 4.4 AirKorea — Nearest Station & Real-time Measurements

**Auth**

* Query: `serviceKey=${AIRKOREA_API_KEY}` (URL-encoded).
* Common query: `returnType=json`

**Flow**

1. Convert **WGS84 (lat, lon)** → **TM (tmX, tmY)** (AirKorea uses TM for nearest-station search).
2. Call **nearest station** endpoint with `(tmX, tmY)` to get `stationName`.
3. Call **real-time measurements** endpoint with `stationName` to get PM values and KHAI.

**Endpoints (GET)**

* `${AIRKOREA_BASE_URL}/getNearbyMsrstnList` → nearest stations

  * Query: `tmX`, `tmY`, `returnType=json`
* `${AIRKOREA_BASE_URL}/getMsrstnAcctoRltmMesureDnsty` → real-time by station

  * Query: `stationName`, `dataTerm=DAILY`, `numOfRows=1`, `returnType=json`

**Sample curl**

```bash
# Nearest station
curl -G "$AIRKOREA_BASE_URL/getNearbyMsrstnList" \
  --data-urlencode "serviceKey=$AIRKOREA_API_KEY" \
  --data-urlencode "tmX=199376.98" \
  --data-urlencode "tmY=444810.79" \
  --data-urlencode "returnType=json"

# Real-time measurements
curl -G "$AIRKOREA_BASE_URL/getMsrstnAcctoRltmMesureDnsty" \
  --data-urlencode "serviceKey=$AIRKOREA_API_KEY" \
  --data-urlencode "stationName=중구" \
  --data-urlencode "dataTerm=DAILY" \
  --data-urlencode "numOfRows=1" \
  --data-urlencode "returnType=json"
```

**Mapping**

| External                | Type/Unit          | Internal                      | Transform                                         |
| ----------------------- | ------------------ | ----------------------------- | ------------------------------------------------- |
| `pm25Value`/`pm10Value` | ㎍/m³ (string)      | `pm25`/`pm10`                 | `"-"`→null; else `parseInt`                       |
| `pm25Grade`/`pm10Grade` | 1..4               | `pm25Category`/`pm10Category` | 1 Good, 2 Moderate, 3 Unhealthy, 4 Very Unhealthy |
| `khaiValue`/`khaiGrade` | numeric / 1..4     | `aqi`/`aqiCategory`           | numeric + 1..4 mapping                            |
| `dataTime`              | `YYYY-MM-DD HH:mm` | `observedAt`                  | pass-through ISO if needed                        |

**Adapter sketch — `server/src/adapters/airkorea.adapter.ts`**

```ts
import { ENV } from '../lib/env';
import { liveOrMock } from '../lib/liveOrMock';
import { http } from '../lib/http';
import fs from 'fs/promises';
import path from 'path';
import { wgs84ToTM, pickNearestStation, normalizeAirPayload } from '../lib/airkorea.util';

const FIX = path.join(__dirname, '../../fixtures');

export class AirKoreaAdapter {
  async realtime(lat: number, lon: number) {
    return liveOrMock({
      adapter: 'AIRKOREA',
      hasKeys: !!ENV.AIRKOREA_API_KEY,
      live: async () => {
        const { tmX, tmY } = wgs84ToTM(lat, lon);
        const near = await http.get(`${ENV.AIRKOREA_BASE_URL}/getNearbyMsrstnList`, {
          params: { serviceKey: ENV.AIRKOREA_API_KEY, tmX, tmY, returnType: 'json' },
        });
        const stationName = pickNearestStation(near.data); // robust pick/fallback
        const rt = await http.get(`${ENV.AIRKOREA_BASE_URL}/getMsrstnAcctoRltmMesureDnsty`, {
          params: { serviceKey: ENV.AIRKOREA_API_KEY, stationName, dataTerm: 'DAILY', numOfRows: 1, returnType: 'json' },
        });
        return normalizeAirPayload(rt.data);
      },
      mock: async () => {
        const raw = await fs.readFile(path.join(FIX, 'airkorea_realtime.sample.json'), 'utf-8');
        return normalizeAirPayload(JSON.parse(raw));
      },
    });
  }
}
```

---

## 5) Error & Fallback Matrix

| Scenario          | Expected HTTP / Symptom    | Adapter behavior                           | Log (sanitized)                      |
| ----------------- | -------------------------- | ------------------------------------------ | ------------------------------------ |
| Timeout / network | No response / ECONNABORTED | Fallback to fixture                        | `warn: [ADAPTER] timeout …`          |
| 401/403           | Auth failure               | Fallback; suggest key check                | `warn: [ADAPTER] auth …`             |
| 429               | Rate limit                 | Optional short backoff once, then fallback | `warn: [ADAPTER] 429 …`              |
| 5xx               | Upstream error             | Retry GETs (≤ attempts), then fallback     | `warn: [ADAPTER] 5xx …`              |
| 200 + malformed   | Schema drift               | Fallback; raise error metric               | `error: [ADAPTER] schema mismatch …` |
| Empty payload     | No records                 | Fallback                                   | `warn: [ADAPTER] empty result …`     |

**Secrets:** Never log `*_API_KEY`. Mask values if you must reference the variable name.

---

## 6) Acceptance Criteria

* **No keys + `MOCK=1`** → exact current fixture responses.
* **Valid keys + `MOCK=1`** → live data returned; if live fails, automatic fixture fallback keeps UI functional.
* **Valid keys + `MOCK=0`** → live preferred; on failure, fixture fallback + warning log.
* Response objects match **internal types** and units (distance km, duration min, temperatures ℃, PM μg/m³).
* No `TODO` stubs remain in adapters; mapping is deterministic and null-safe.
* Logs never print secrets.

---

## 7) Test Plan

**Unit (pure functions)**

* Mapping functions: given trimmed provider samples → produce exact internal objects (snapshot tests OK).
* Grid/time utilities (KMA): `latLonToGrid`, `selectBaseSlots` edge cases.

**Integration (mocked HTTP)**

* Happy path (200 OK).
* Timeout/network error → fallback.
* 401/403, 429, 5xx → fallback rules.
* Malformed/empty body → fallback.

**Optional Canary (env-gated)**

* With real keys in CI secret or local, hit one route/forecast/air call to validate auth without burning quota.

---

## 8) Operational Playbook

* **Rate limit/backoff:** retry only for network/5xx; use exponential jitter (e.g., 300ms → 900ms).
* **Provider maintenance/outages:** expect public endpoints to flap; fallback keeps responses flowing.
* **Freshness:**

  * Expressway: 5-minute bins; always take the latest available record.
  * KMA: slot rules; if latest slot empty, fall back to previous slot once.
  * AirKorea: if first station returns missing values (`"-"`), try next nearest.
* **Version changes:** prefer stable fields; if a field disappears, treat as schema drift → fallback + metric.

---

## 9) Developer Checklist (Do This)

1. **Wire adapters with `liveOrMock()`** (keep public method signatures unchanged).
2. **Implement HTTP calls** exactly as in §4; set headers/params and base URLs from `.env`.
3. **Complete mapping functions** to internal types (distance/time unit conversion, code→text where required).
4. **Implement KMA & AirKorea utilities**: grid conversion, slot selection, WGS84→TM, nearest-station pick.
5. **Sanitize logs** (never print keys).
6. **Add tests** from §7 and run them.
7. Keep `MOCK=1` for default deployments; once keys are introduced, live will be attempted automatically.

---

## 10) Appendix — Internal Type Hints (example)

```ts
// Traffic
export type TrafficStep = { label: string; polyline: number[][]; distanceKm?: number; durationMin?: number; };
export type TrafficBrief = { distanceKm: number; durationMin: number; steps: TrafficStep[]; };

// Weather
export type WeatherBrief = {
  temperature: number; humidity?: number; skyCode?: number; precipType?: 'none'|'rain'|'sleet'|'snow'|'shower';
  precipMm?: number; windSpeed?: number; windDegree?: number; minTemp?: number; maxTemp?: number;
};

// Air quality
export type AirQualityBrief = {
  pm25: number|null; pm10: number|null; pm25Category?: 'Good'|'Moderate'|'Unhealthy'|'Very Unhealthy';
  pm10Category?: 'Good'|'Moderate'|'Unhealthy'|'Very Unhealthy';
  aqi?: number|null; aqiCategory?: 'Good'|'Moderate'|'Unhealthy'|'Very Unhealthy'; observedAt?: string;
};
```

---

This document is the **final developer version**. Implement the HTTP blocks and mapping functions as instructed, keep `MOCK=1` by default, and once keys are present, the system will **try live first** and **gracefully degrade** to fixtures on failure.
