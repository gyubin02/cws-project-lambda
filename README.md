# 🌤️ Commute Briefing (Fixture Mode)

TMAP city routing, Korea Expressway tollgate travel time, KMA short-term forecast, and AirKorea realtime air-quality feeds are normalised into a unified morning briefing. External HTTP calls are replaced with local fixtures until official specifications are confirmed, but the service already exercises the full parsing, caching, and aggregation pipeline.

## Backend Stack

- **Node.js 20+ / TypeScript**
- **Express.js** with **zod** request validation
- **Axios** + **axios-retry** with local fixture adapters
- **pino** structured logging + request correlation
- **node-cache** for per-mode TTL caching
- **node:test** for unit/E2E coverage (compiled build artefacts)

## Quick Start

```bash
# 1) install dependencies
pnpm install
pnpm -C server install

# 2) configure env
cp server/env.example server/.env

# 3) run the API (fixture mode)
pnpm -C server dev
```

The API listens on `http://localhost:8787`.

## Environment Variables (`server/.env`)

```env
NODE_ENV=development
PORT=8787
CORS_ORIGINS=http://localhost:5173
MOCK=1

# ↓ real keys will be wired once official docs arrive ↓
KMA_SERVICE_KEY=
AIRKOREA_SERVICE_KEY=
EXPRESSWAY_API_KEY=
TMAP_API_KEY=

HTTP_TIMEOUT_MS=4500
HTTP_RETRY=1
CACHE_TTL_SEC=300
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=120
```

## Using the API (Fixture Data)

1. Save a profile
   ```bash
   curl -X POST http://localhost:8787/api/v1/profile \
     -H 'Content-Type: application/json' \
     -d '{"user_id":"alice","preferred_mode":"car","tz":"Asia/Seoul","home":{"lat":37.55,"lon":126.98},"work":{"lat":37.40,"lon":127.10}}'
   ```
2. Fetch a briefing
   ```bash
   curl 'http://localhost:8787/api/v1/briefing?user_id=alice'
   ```
3. Or query directly with coordinates
   ```bash
   curl 'http://localhost:8787/api/v1/briefing?from=37.55,126.98&to=37.40,127.10'
   ```

## Tests

All tests run against the compiled backend artefacts.

```bash
cd server
pnpm build
pnpm test
```

Unit suites cover fixture parsing for the adapters and services; an integration test calls `buildBriefing` with stored and ad-hoc coordinates.

## Project Layout

```
cws-project/
├── server/
│   ├── src/
│   │   ├── adapters/     # TMAP / Expressway / KMA / AirKorea fixture adapters
│   │   ├── services/     # Weather, air, traffic, recommendation, profile, briefing
│   │   ├── routes/       # /api/v1 endpoints
│   │   ├── lib/          # env, cache, logger, rate limit, utilities
│   │   └── types/        # Normalised domain types
│   ├── tests/            # node:test suites (require dist modules)
│   ├── openapi.yaml      # Updated API contract
│   └── package.json
├── fixtures/             # Local JSON fixtures for Plan B
└── README.md
```

## Key Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| POST / GET | `/api/v1/profile` | Persist and retrieve commute preferences |
| GET | `/api/v1/briefing` | Integrated weather/air/traffic briefing |
| GET | `/api/v1/weather` | KMA weather brief for coordinates |
| GET | `/api/v1/air` | AirKorea air-quality brief |
| GET | `/api/v1/traffic/car` | TMAP car routing brief |
| GET | `/api/v1/traffic/transit` | TMAP transit routing brief |
| GET | `/api/v1/traffic/expressway` | Expressway tollgate travel time |
| GET | `/api/v1/healthz` | Service health status |

## Fixture Mode Notes

- Requests are cached by origin/destination/mode using 5–10 minute buckets.
- Missing API keys are surfaced via `source_status` and propagated into briefing notices.
- Recommendation logic compares car vs transit ETA, POP bias, and expressway parity.
- Rate limiting defaults to 120 requests per minute across the entire API.

When official documentation and live keys arrive, replace the fixture loaders inside each adapter (look for `TODO` comments) and retain the normalised response shapes.
