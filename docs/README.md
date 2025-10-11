# Traffic Live vs Mock

This project now supports live and fail-open mock traffic data sources. Use the following environment flags when running the server:

- `MOCK=0` — call live TMAP Car, TMAP Transit, and Korea Expressway APIs. Responses report `source_status: "ok"` when upstream requests succeed.
- `MOCK=1` — stay fail-open: the server serves fixtures or cached data and labels responses with `source_status: "mock"` or `"degraded"` when upstream data is unavailable.

Required environment variables:

```
TMAP_API_KEY=...
TMAP_BASE_URL=https://apis.openapi.sk.com/tmap
TMAP_TRANSIT_PATH=/routes/transit
TMAP_CAR_PATH=/routes
EXPRESSWAY_API_KEY=...
ETA_TIE_THRESHOLD_MIN=3
```

The aggregated endpoint `GET /api/v1/traffic/city` fetches both car and transit ETAs, attaches tollgate congestion to car routes, and surfaces a recommendation comparing the modes.
