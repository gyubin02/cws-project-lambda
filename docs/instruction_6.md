# RFC: Enable **Per-Adapter Live/Mock** Mode (Allow Partial Live with Only TMAP Key)

**Status:** Proposed
**Owners:** Backend team
**Audience:** Server engineers (TypeScript/Express)
**Applies to:** `cws-project/server`
**Goal ship date:** ASAP

---

## 1) Objective

Today the server treats `MOCK=0` as “**all adapters must run live**”. If any API key is missing at boot, the app throws:

```
Missing required API keys with MOCK=0: EXPRESSWAY_API_KEY, KMA_API_KEY, AIRKOREA_API_KEY
```

We need to **allow partial live** operation:

* If `MOCK=0` and **an adapter has its API key**, run that adapter **live**.
* If `MOCK=0` and **an adapter lacks its key**, run that adapter in **mock**.
* If `MOCK=1`, everything stays **mock** (unchanged).

This lets us run **TMAP live** while **KMA/AirKorea/Expressway** fall back to fixtures—without crashing the server.

---

## 2) Non-Goals

* No change to request/response schemas.
* No change to fixture files.
* No introduction of new environment variables (we only add aliases for existing names).

---

## 3) Environment Variables (normalized)

Support both historical and alternative names to avoid confusion:

| Logical Service | Accepted Env Vars (first non-empty wins)          |
| --------------- | ------------------------------------------------- |
| TMAP            | `TMAP_API_KEY`                                    |
| KMA             | `KMA_SERVICE_KEY`, `KMA_API_KEY`                  |
| AirKorea        | `AIRKOREA_SERVICE_KEY`, `AIRKOREA_API_KEY`        |
| Expressway      | `EXPRESSWAY_API_KEY`                              |
| Global          | `MOCK` (`"0"` = live-capable, `"1"` = force mock) |

> Implementation detail: interpret empty strings as “absent”.

---

## 4) High-Level Design

1. **Relax** the global boot preflight that currently enforces “all keys required when `MOCK=0`”.
2. Centralize env resolution in `lib/env.ts`, providing **aliases** for KMA/AirKorea.
3. Provide a **per-adapter decision helper** `liveOrMock(adapter)`:

   * If `MOCK===1` → `"mock"`.
   * If `MOCK===0` → `"live"` **iff** that adapter has a key; otherwise `"mock"`.
4. Each adapter (`adapters/*.adapter.ts`) uses `liveOrMock('adapter')` to choose its execution branch.
5. On boot, **log warnings** for missing keys, but **do not throw**.

---

## 5) Step-by-Step Changes

### 5.1 `server/src/lib/env.ts`

Create/replace with:

```ts
// server/src/lib/env.ts
export type Env = {
  MOCK: 0 | 1;
  TMAP_API_KEY: string;
  KMA_SERVICE_KEY: string;        // normalized (alias of KMA_API_KEY)
  AIRKOREA_SERVICE_KEY: string;   // normalized (alias of AIRKOREA_API_KEY)
  EXPRESSWAY_API_KEY: string;
};

function pick(...candidates: Array<string | undefined | null>): string {
  for (const c of candidates) if (c && c.trim().length > 0) return c.trim();
  return '';
}

export const ENV: Env = {
  MOCK: process.env.MOCK === '0' ? 0 : 1,
  TMAP_API_KEY: pick(process.env.TMAP_API_KEY),
  KMA_SERVICE_KEY: pick(process.env.KMA_SERVICE_KEY, process.env.KMA_API_KEY),
  AIRKOREA_SERVICE_KEY: pick(process.env.AIRKOREA_SERVICE_KEY, process.env.AIRKOREA_API_KEY),
  EXPRESSWAY_API_KEY: pick(process.env.EXPRESSWAY_API_KEY),
};
```

> **Remove** any previous code that throws when `MOCK===0` and some keys are missing.

---

### 5.2 `server/src/lib/liveOrMock.ts`

Create/replace with:

```ts
// server/src/lib/liveOrMock.ts
import { ENV } from './env';

export type AdapterName = 'tmap' | 'kma' | 'airkorea' | 'expressway';
export type Mode = 'live' | 'mock';

function hasKey(adapter: AdapterName): boolean {
  switch (adapter) {
    case 'tmap': return !!ENV.TMAP_API_KEY;
    case 'kma': return !!ENV.KMA_SERVICE_KEY;
    case 'airkorea': return !!ENV.AIRKOREA_SERVICE_KEY;
    case 'expressway': return !!ENV.EXPRESSWAY_API_KEY;
  }
}

export function liveOrMock(adapter: AdapterName): Mode {
  if (ENV.MOCK === 1) return 'mock';
  return hasKey(adapter) ? 'live' : 'mock';
}
```

---

### 5.3 Boot-time Logging (optional but recommended)

In `server/src/app.ts` (or wherever bootstraps happen):

```ts
import { ENV } from './lib/env';
import { logger } from './lib/logger';

// Replace any "throw on missing keys" with non-fatal warnings:
logger.info(`MOCK=${ENV.MOCK} (0=live-capable, 1=force-mock)`);

if (!ENV.TMAP_API_KEY) logger.warn('TMAP live disabled (no TMAP_API_KEY) → mock fallback');
if (!ENV.KMA_SERVICE_KEY) logger.warn('KMA live disabled (no KMA_SERVICE_KEY) → mock fallback');
if (!ENV.AIRKOREA_SERVICE_KEY) logger.warn('AirKorea live disabled (no AIRKOREA_SERVICE_KEY) → mock fallback');
if (!ENV.EXPRESSWAY_API_KEY) logger.warn('Expressway live disabled (no EXPRESSWAY_API_KEY) → mock fallback');
```

---

### 5.4 Use in Adapters (pattern)

Ensure each adapter selects its branch via `liveOrMock(...)`.

**Example: `server/src/adapters/tmap.adapter.ts` (excerpt)**

```ts
import { liveOrMock } from '../lib/liveOrMock';
import { ENV } from '../lib/env';
import { UpstreamError } from '../lib/errors';

export async function geocode(query: string) {
  const mode = liveOrMock('tmap');

  if (mode === 'mock') {
    // load fixtures/tmap_geocode.sample.json and map
    return geocodeFromFixture(query);
  }

  // LIVE path requires ENV.TMAP_API_KEY (guaranteed by liveOrMock)
  const key = ENV.TMAP_API_KEY;
  if (!key) throw new UpstreamError('TMAP missing API key in live path', 'bad_config');
  return geocodeViaTmapApi(query, key);
}
```

**Example: `server/src/adapters/kma.adapter.ts` (excerpt)**

```ts
import { liveOrMock } from '../lib/liveOrMock';
import { ENV } from '../lib/env';

export async function getForecast(params: KmaParams) {
  const mode = liveOrMock('kma');
  if (mode === 'mock') return forecastFromFixture(params);

  const key = ENV.KMA_SERVICE_KEY;
  if (!key) return forecastFromFixture(params); // defensive
  return forecastViaKmaApi(params, key);
}
```

Repeat for `airkorea.adapter.ts` and `expressway.adapter.ts`.

---

### 5.5 (Optional) Mock strictness fix for geocoding

If mock geocoder currently returns the **first** result when there is **no exact match**, change it to **throw** (or 404) to avoid “false successes”:

```ts
// inside mock geocode mapper:
const normalized = query.trim();
const match = payload.results.find((r: any) => r.query === normalized);
if (!match?.coordinates?.lat || !match?.coordinates?.lon) {
  throw new UpstreamError(`TMAP geocode mock: no exact match for "${normalized}"`, 'bad_response');
}
return match.coordinates;
```

---

## 6) Backward Compatibility

* When `MOCK=1`, behavior remains exactly the same (fully mocked).
* When `MOCK=0`, the server **no longer fails fast** if some keys are missing; it runs live where possible, mock otherwise.
* Existing routes, response shapes, and fixtures remain unchanged.

---

## 7) Configuration Examples

### 7.1 “TMAP-only live”

```env
MOCK=0
TMAP_API_KEY=REAL_TMAP_KEY

# Others intentionally absent or empty:
KMA_SERVICE_KEY=
AIRKOREA_SERVICE_KEY=
EXPRESSWAY_API_KEY=
```

### 7.2 “Everything mock”

```env
MOCK=1
TMAP_API_KEY=
KMA_SERVICE_KEY=
AIRKOREA_SERVICE_KEY=
EXPRESSWAY_API_KEY=
```

### 7.3 “Everything live”

```env
MOCK=0
TMAP_API_KEY=...
KMA_SERVICE_KEY=...
AIRKOREA_SERVICE_KEY=...
EXPRESSWAY_API_KEY=...
```

> `KMA_API_KEY` / `AIRKOREA_API_KEY` aliases are also accepted.

---

## 8) Tests

### 8.1 Unit: `liveOrMock.spec.ts`

* `MOCK=1` → all adapters return `"mock"`.
* `MOCK=0` + only TMAP key set → `"tmap":"live"`, others `"mock"`.
* `MOCK=0` + all keys set → all `"live"`.
* `MOCK=0` + no keys → all `"mock"`.

### 8.2 Integration (supertest)

1. **TMAP-only live** env.

   * `POST /api/v1/settings` with `{ defaultOrigin:{name:"건대입구역"}, defaultDestination:{name:"광화문"} }`
   * Expect status 200 and **real TMAP coordinates** persisted.
2. `GET /api/v1/briefing?from=건대입구역&to=광화문`

   * In `meta`, `traffic.source` should indicate **live**.
   * `weather/air/expressway` blocks should indicate **mock**.
3. **Invalid geocode string** in mock should 400 (if strictness patch applied).

---

## 9) Error Handling & Observability

* Replace “fatal missing key” boot errors with **warnings**.
* Keep per-adapter **defensive checks** even in live mode (e.g., if a key is unexpectedly empty, fall back to mock and log `warn`).
* Include a `meta.sources` (or equivalent) field in route responses specifying, per domain, `"live"` vs `"mock"` for transparency.

---

## 10) Migration Plan

1. Implement files in §5.1–§5.4.
2. Remove any global “require all keys when `MOCK=0`” logic.
3. Deploy behind a feature flag if needed (e.g., `ALLOW_PARTIAL_LIVE=1`).
4. Verify with **TMAP-only** live env in staging.
5. Roll out to dev/prod.

---

## 11) Example Commit/PR

**Commit message**

```
feat(server): allow per-adapter live/mock mode; enable partial live with only TMAP key

- Normalize env vars with aliases (KMA_SERVICE_KEY|KMA_API_KEY, AIRKOREA_SERVICE_KEY|AIRKOREA_API_KEY)
- Introduce liveOrMock(adapter) to decide mode per adapter
- Remove global boot-time “all keys required when MOCK=0” check
- Add boot warnings for missing keys instead of throwing
- (optional) Make mock geocoder strict on non-exact matches
```

**PR description (copy-paste)**

* **Why:** We need to run live TMAP while other services remain mocked when their keys are missing. Current behavior aborts boot if any key is absent with `MOCK=0`.
* **What:**

  * `lib/env.ts`: normalize env + aliases
  * `lib/liveOrMock.ts`: per-adapter mode selection
  * Remove global fatal preflight; add non-fatal warnings
  * Adapters consult `liveOrMock()`
  * (optional) mock geocoder exact-match enforcement
* **How to test:** See §8 (unit + integration).
* **Backward-compat:** `MOCK=1` unchanged; `MOCK=0` now supports partial live.

---

## 12) FAQ

**Q: Do we ever throw on missing keys now?**
A: Not at boot. Adapters should log and fall back to mock if a key is missing or invalid.

**Q: What if an upstream live call fails (quota, 5xx)?**
A: Adapter should map upstream errors to our domain errors, and—depending on route—either propagate 4xx/5xx or (if acceptable) degrade to mock with a `meta.warning`.

**Q: Do we need to touch the frontend?**
A: No. The API remains the same. The `meta` section will reflect the live/mock sources for transparency.

---

With this patch, **“TMAP-only live”** works cleanly, while the rest of the stack remains stable via fixtures.
