# CWS Project — Safe Refactoring Guide

_Generated on 2025-10-07 06:39:12_

## 0) Purpose & Scope


This document is a **developer-focused, step-by-step plan** to refactor the project **without changing behavior**.
It defines invariants, target module boundaries, a phased plan, acceptance tests, and rollback strategy.
Follow the phases in order; do not batch unrelated changes in the same PR.

## 1) Current Snapshot (auto-detected)

- Root: `/mnt/data/cws-project`

**Largest TS/TSX files by LOC** (top ~12):

|    | path                                                       |   loc |
|---:|:-----------------------------------------------------------|------:|
|  0 | cws-project-main/src/components/ui/sidebar.tsx             |   638 |
|  1 | cws-project-main/server/src/adapters/tmap.adapter.ts       |   609 |
|  2 | cws-project-main/src/components/ui/chart.tsx               |   304 |
|  3 | cws-project-main/server/src/lib/kma.util.ts                |   267 |
|  4 | cws-project-main/src/lib/api.ts                            |   260 |
|  5 | cws-project-main/server/src/lib/util.ts                    |   246 |
|  6 | cws-project-main/src/features/profile/ProfilePage.tsx      |   240 |
|  7 | cws-project-main/src/components/ui/carousel.tsx            |   225 |
|  8 | cws-project-main/server/src/adapters/expressway.adapter.ts |   220 |
|  9 | cws-project-main/server/src/routes/weather.routes.ts       |   220 |
| 10 | cws-project-main/server/src/routes/air.routes.ts           |   218 |
| 11 | cws-project-main/src/components/AirQualityDetailModal.tsx  |   214 |


**Adapter/Service/Routes candidates** (high LOC first):

| path                                                       |   loc |
|:-----------------------------------------------------------|------:|
| cws-project-main/server/src/adapters/tmap.adapter.ts       |   609 |
| cws-project-main/server/src/adapters/expressway.adapter.ts |   220 |
| cws-project-main/server/src/routes/weather.routes.ts       |   220 |
| cws-project-main/server/src/routes/air.routes.ts           |   218 |
| cws-project-main/server/src/routes/briefing.routes.ts      |   193 |
| cws-project-main/server/src/services/briefing.service.ts   |   177 |
| cws-project-main/server/src/adapters/kma.adapter.ts        |   171 |
| cws-project-main/server/src/services/traffic.service.ts    |   152 |
| cws-project-main/server/src/adapters/airkorea.adapter.ts   |   137 |
| cws-project-main/server/src/routes/traffic.routes.ts       |   122 |
| cws-project-main/server/src/routes/settings.routes.ts      |   115 |
| cws-project-main/server/src/services/recommend.service.ts  |   112 |
| cws-project-main/server/src/services/settings.service.ts   |    81 |
| cws-project-main/server/src/routes/health.routes.ts        |    72 |
| cws-project-main/server/src/services/profile.service.ts    |    64 |
| cws-project-main/server/src/services/air.service.ts        |    48 |
| cws-project-main/server/src/services/weather.service.ts    |    44 |
| cws-project-main/server/src/routes/profile.routes.ts       |    40 |


**package.json overview**:

- `cws-project-main/package.json` → name=`vite_react_shadcn_ts` private=`True` workspaces=`False` scripts=['dev', 'build', 'build:dev', 'lint', 'preview']
- `cws-project-main/server/package.json` → name=`outing-briefing-server` private=`None` workspaces=`False` scripts=['dev', 'build', 'start', 'lint', 'lint:fix', 'test', 'test:watch']


> ⚠️ Detected `eslint.config.js` (flat config) **and** scripts using `--ext`. Update scripts to `eslint .` with proper globs.

**Error codes found (heuristic):** bad_request, geocode_failed_live_only, internal_error, location_not_found, not_found, rate_limited, timeout


## 2) Invariants (Do-Not-Break)


- Public API routes, request/response JSON **shape and semantics unchanged**.
- HTTP status codes and `error` codes (e.g., `bad_request`, `location_not_found`, `geocode_failed_live_only`) **unchanged**.
- Caching behavior and TTLs: do not reduce cache hit ratio or increase external API calls.
- Rate-limit and retry behavior: no additional upstream pressure.
- **Environment variable names remain the same** (see table above).
- Telemetry/log formats remain parseable by existing consumers (if any).


## 3) Target Architecture (Module Boundaries)


**Per upstream (TMAP, KMA, AirKorea, Expressway), split each adapter into:**

- `client.ts` — HTTP calls only (base URL, headers, retries/backoff). No domain logic.
- `schema.ts` — Zod schemas for request/response (runtime validation).
- `mapper.ts` — pure functions mapping provider DTO → internal types.
- `types.ts` — TypeScript domain types and enums (shared).
- `errors.ts` — typed `AppError` helpers for consistent error taxonomy.
- `index.ts` — trivial exports to keep imports tidy.

**Cross-cutting libraries (in `server/src/lib/`):**
- `http.ts` (fetch/axios wrapper with tracing, timeouts, retry policy),
- `cache.ts` (TTL constants per provider, stable cache key prefixes),
- `rateLimit.ts` (token bucket or leaky-bucket, per-provider budget),
- `env.ts` (Zod-validated env loader),
- `logger.ts` (structured logs).

**Routes/Services:** Routes stay thin; Services orchestrate across providers using the mappers/types only.


## 4) Phased Plan (with Acceptance Criteria)


**Phase 0 — Baseline & Safety Nets**
- Freeze feature work for the duration of refactor.
- Add a `baseline:e2e` script: smoke call for each public route; store snapshots of response **shape** (not dynamic values).
- Capture performance baseline (p95 latency per route) and external-call counts.

**Phase 1 — Tooling Stabilization**
- Fix ESLint script if flat config is used: replace `eslint --ext ...` with `eslint .` and proper ignores.
- Ensure Prettier + TypeScript config consistent across packages (root → package inheritance).
- Add CI: `pnpm -w typecheck && pnpm -w lint && pnpm -w test`.

**Acceptance:** CI is green; no source changes yet.

**Phase 2 — Env & Error Taxonomy**
- Introduce `env.ts` (Zod) with all required keys (no behavioral changes).
- Create `errors.ts` with `AppError`/`ErrorKind` union: `bad_request | upstream_failed | timeout | rate_limited | schema_mismatch | internal_error`.
- Replace ad-hoc throws in **one** adapter to use the taxonomy (as a pilot).

**Acceptance:** All tests pass; public responses identical; logs show new error kinds for pilot path only.

**Phase 3 — Extract Schemas & Mappers (by Provider)**
- For each provider: add `schema.ts` with strict Zod of the current live/fixture DTOs.
- Wrap adapter entry with `schema.parse` to fail-fast on provider drift; map to internal `types.ts` via `mapper.ts`.

**Acceptance:** Contract tests pass with fixtures (success & error); no external calls increased.

**Phase 4 — Client/HTTP Split + Retry/RateLimit Centralization**
- Move raw HTTP into `client.ts` using shared `http.ts` wrapper with standardized timeouts and backoff.
- Move rate-limit decisions to `lib/rateLimit.ts` and cache keys to `lib/cache.ts`.

**Acceptance:** p95 latency unchanged (±5%); external-call counts not increased; e2e snapshots unchanged.

**Phase 5 — Service Composition & Route Thinning**
- Ensure routes delegate to services only; no provider DTO logic in routes.
- Keep services pure and deterministic where possible; isolate side effects.

**Acceptance:** Code owners sign-off; linters/enforcers catch any DTO leakage in routes.

**Phase 6 — Observability**
- Add `/health` matrix: `{ "tmap": { "ok": true, "lastSuccess": "..." }, ... }`.
- Add minimal histogram timers around each provider call.

**Acceptance:** Ops/QA can triage upstream issues without code changes.

**Phase 7 — Cleanup & Deprecations**
- Remove dead code, duplicated helpers, and legacy fixture paths not used by tests.
- Update docs and diagrams.


## 5) File-by-File Refactor Targets (Top offenders)

### cws-project-main/src/components/ui/sidebar.tsx  (`~638` LOC)


- **Action:** Split into `client.ts`, `schema.ts`, `mapper.ts`, `types.ts`, and `errors.ts`.
- **Notes:** Keep existing exported function names via `index.ts` re-exports to avoid import churn.
- **Tests:** Add contract tests with provider fixtures (success + malformed payloads).

### cws-project-main/server/src/adapters/tmap.adapter.ts  (`~609` LOC)


- **Action:** Split into `client.ts`, `schema.ts`, `mapper.ts`, `types.ts`, and `errors.ts`.
- **Notes:** Keep existing exported function names via `index.ts` re-exports to avoid import churn.
- **Tests:** Add contract tests with provider fixtures (success + malformed payloads).

### cws-project-main/src/components/ui/chart.tsx  (`~304` LOC)


- **Action:** Split into `client.ts`, `schema.ts`, `mapper.ts`, `types.ts`, and `errors.ts`.
- **Notes:** Keep existing exported function names via `index.ts` re-exports to avoid import churn.
- **Tests:** Add contract tests with provider fixtures (success + malformed payloads).

### cws-project-main/server/src/lib/kma.util.ts  (`~267` LOC)


- **Action:** Split into `client.ts`, `schema.ts`, `mapper.ts`, `types.ts`, and `errors.ts`.
- **Notes:** Keep existing exported function names via `index.ts` re-exports to avoid import churn.
- **Tests:** Add contract tests with provider fixtures (success + malformed payloads).

### cws-project-main/src/lib/api.ts  (`~260` LOC)


- **Action:** Split into `client.ts`, `schema.ts`, `mapper.ts`, `types.ts`, and `errors.ts`.
- **Notes:** Keep existing exported function names via `index.ts` re-exports to avoid import churn.
- **Tests:** Add contract tests with provider fixtures (success + malformed payloads).

### cws-project-main/server/src/lib/util.ts  (`~246` LOC)


- **Action:** Split into `client.ts`, `schema.ts`, `mapper.ts`, `types.ts`, and `errors.ts`.
- **Notes:** Keep existing exported function names via `index.ts` re-exports to avoid import churn.
- **Tests:** Add contract tests with provider fixtures (success + malformed payloads).

### cws-project-main/src/features/profile/ProfilePage.tsx  (`~240` LOC)


- **Action:** Split into `client.ts`, `schema.ts`, `mapper.ts`, `types.ts`, and `errors.ts`.
- **Notes:** Keep existing exported function names via `index.ts` re-exports to avoid import churn.
- **Tests:** Add contract tests with provider fixtures (success + malformed payloads).

### cws-project-main/src/components/ui/carousel.tsx  (`~225` LOC)


- **Action:** Split into `client.ts`, `schema.ts`, `mapper.ts`, `types.ts`, and `errors.ts`.
- **Notes:** Keep existing exported function names via `index.ts` re-exports to avoid import churn.
- **Tests:** Add contract tests with provider fixtures (success + malformed payloads).

### cws-project-main/server/src/adapters/expressway.adapter.ts  (`~220` LOC)


- **Action:** Split into `client.ts`, `schema.ts`, `mapper.ts`, `types.ts`, and `errors.ts`.
- **Notes:** Keep existing exported function names via `index.ts` re-exports to avoid import churn.
- **Tests:** Add contract tests with provider fixtures (success + malformed payloads).

### cws-project-main/server/src/routes/weather.routes.ts  (`~220` LOC)


- **Action:** Split into `client.ts`, `schema.ts`, `mapper.ts`, `types.ts`, and `errors.ts`.
- **Notes:** Keep existing exported function names via `index.ts` re-exports to avoid import churn.
- **Tests:** Add contract tests with provider fixtures (success + malformed payloads).

### cws-project-main/server/src/routes/air.routes.ts  (`~218` LOC)


- **Action:** Split into `client.ts`, `schema.ts`, `mapper.ts`, `types.ts`, and `errors.ts`.
- **Notes:** Keep existing exported function names via `index.ts` re-exports to avoid import churn.
- **Tests:** Add contract tests with provider fixtures (success + malformed payloads).

### cws-project-main/src/components/AirQualityDetailModal.tsx  (`~214` LOC)


- **Action:** Split into `client.ts`, `schema.ts`, `mapper.ts`, `types.ts`, and `errors.ts`.
- **Notes:** Keep existing exported function names via `index.ts` re-exports to avoid import churn.
- **Tests:** Add contract tests with provider fixtures (success + malformed payloads).


## 6) Testing Strategy

Routes location hint: `/src/routes` (adjust if different).


- **Unit tests:** mappers and schemas (pure). Use fixture snapshots to detect provider drift.
- **Contract tests:** For each provider adapter, cover: success, missing fields, error codes (429/5xx), timeouts.
- **Integration tests:** Route-level with in-memory server (no network): stub adapters via DI.
- **E2E smoke:** Hit `/health`, `/briefing`, `/weather`, `/air`.
- **Golden snapshots:** Only for **shapes**; ignore volatile values (timestamps, IDs) with serializers.


## 7) Environment & Configuration Hardening

- Validate **all** required env keys at startup via `zod` (example below). Keys seen in repo (subset): (keys auto-detection inconclusive)


```ts
// server/src/lib/env.ts
import { z } from "zod";

export const Env = z.object({
  NODE_ENV: z.enum(["development","test","production"]),
  TMAP_API_KEY: z.string().min(1),
  // Add KMA, AIRKOREA, EXPRESSWAY, etc.
}).transform((e) => ({
  ...e,
  isProd: e.NODE_ENV === "production",
}));

export const env = Env.parse(process.env);
```


## 8) Error Taxonomy & Handler


```ts
// server/src/lib/errors.ts
export type ErrorKind =
  | "bad_request"
  | "upstream_failed"
  | "timeout"
  | "rate_limited"
  | "schema_mismatch"
  | "internal_error";

export class AppError extends Error {
  kind: ErrorKind;
  status: number;
  cause?: unknown;
  constructor(kind: ErrorKind, message: string, status = 500, cause?: unknown) {
    super(message);
    this.kind = kind;
    this.status = status;
    this.cause = cause;
  }
}

export const toHttp = (err: unknown) => {
  if (err instanceof AppError) return { status: err.status, body: { error: err.kind, message: err.message } };
  return { status: 500, body: { error: "internal_error", message: "Unexpected error" } };
};
```
Route usage:
```ts
try {
  // ...
} catch (e) {
  const { status, body } = toHttp(e);
  res.status(status).json(body);
}
```


## 9) HTTP Client Wrapper (Timeouts/Retry/Backoff)


```ts
// server/src/lib/http.ts
import axios, { AxiosInstance } from "axios";

export function makeHttp(baseURL: string, defaultHeaders: Record<string,string> = {}): AxiosInstance {
  const client = axios.create({ baseURL, timeout: 8000, headers: defaultHeaders });
  client.interceptors.response.use(r => r, async (err) => {
    // translate common errors; add limited retries for idempotent GETs
    throw err;
  });
  return client;
}
```
Adapters should receive an AxiosInstance via DI; tests inject a mock instance.


## 10) Caching & Rate Limiting


- Centralize cache TTLs in `lib/cache.ts`. Use keys like `tmap:geo:{query}` or `kma:village:{lat},{lng}`.
- Rate limiting: shared `lib/rateLimit.ts` with budgets per provider; return `rate_limited` before hitting upstream.



## 11) Observability & Health


- `/health` root: `{ "ok": true, "build": "...", "time": "..." }`
- `/health/providers`: TMAP/KMA/AirKorea/Expressway: `{ "ok": true, "lastSuccess": "...", "lastError": "...", "quota": "?" }`
- Wrap each provider call with timing and include `x-request-id` in logs.


## 12) CI, Lint, and Formatting


- Run in CI: `pnpm -w typecheck && pnpm -w lint && pnpm -w test`
- Use `eslint.config.js` flat config; update scripts to `eslint .` (no `--ext`).
- Add pre-commit hooks (Husky/Lefthook): run lint & format on staged files.


## 13) Git Workflow & Backout Plan


- Branch per phase: `refactor/phase-2-env-errors`, etc.
- Each PR must: describe scope, link to acceptance criteria, include before/after screenshots for `/health` and e2e snapshots.
- Backout: revert merge commit; no schema changes to public responses until after full rollout.
- Feature flags only if behavior must diverge temporarily (`REFAC_FEATURE_X=1`). Default OFF.


## 14) Acceptance Checklist (per PR)


- [ ] Public API shapes unchanged (diff e2e snapshots)
- [ ] Latency within ±5% of baseline; external calls not increased
- [ ] Unit/contract/integration tests added or updated
- [ ] Logs show no increase in error rate
- [ ] Sufficient docs updated (`README`, this guide)
