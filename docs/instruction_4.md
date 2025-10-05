# Briefing UI Integration – Root Cause & Fix (Frontend ↔ Server)

**Status:** Fixed via frontend normalization layer (option A).
**Last updated:** 2025‑10‑05 (Asia/Seoul)

---

## 1) Executive Summary

* **Problem:** The frontend could not render traffic/weather/air cards correctly after calling `/api/v1/briefing` because the **server response schema** differs from the **UI‑expected types**.
* **Symptom:** Summary banner renders; detailed cards show empty values, "unknown" badges, or error states.
* **Root cause:** Frontend components expect flattened fields (e.g., `traffic.eta_minutes`, `weather.sky`, `air.grade(UPPERCASE)`), while the server returns **nested** and **differently named** fields (e.g., `traffic.car.eta_minutes`, `weather.condition`, `air.grade` in lowercase).
* **Fix:** Add a **normalization layer** in the frontend API client to adapt the server’s response to the UI’s expected shape. (Alternative: refactor UI types/components to consume nested server schema.)

---

## 2) Scope & Affected Components

**Server**

* Endpoint: `GET /api/v1/briefing`
* Structure: `traffic = { car?, transit?, expressway?, ... }` (each a `TrafficBrief`)
* Keys: `weather.condition` (not `sky`), `weather.temp_c` (not `temp`), `air.grade` in lowercase

**Frontend**

* API client: `src/lib/api.ts` (`getBriefing`)
* Types: `src/lib/types.ts` (`Briefing`, `Traffic`, `Weather`, `Air`)
* UI: `TrafficCard`, `WeatherCard`, `AirQualityCard` (expecting flattened fields & specific key names)

---

## 3) Reproduction Steps

1. Run server and frontend locally. Ensure only the TMAP key is active; others use mock.
2. Call:

   ```bash
   curl -G "http://localhost:8080/api/v1/briefing" \
     --data-urlencode "from=강남역" \
     --data-urlencode "to=서울역" | jq .
   ```
3. Observe JSON includes `traffic.car.eta_minutes`, `weather.temp_c`, `weather.condition`, `air.grade`(lowercase), etc.
4. Open the UI: Summary shows, but cards display missing/placeholder values.

**Expected (UI):** Cards render ETA (minutes), distance, weather icon (sky), temperature, AQI badges.
**Actual:** Cards miss values or show fallback states.

---

## 4) Root Cause Analysis

* **Schema mismatch:**

  * **Traffic:** UI expects a single `traffic` object (`eta_minutes`, etc.), but server returns **mode‑keyed variants** (`traffic.car`, `traffic.expressway`, `traffic.transit`).
  * **Weather:** Server uses `condition` + `temp_c`; UI expects `sky` + `temp`.
  * **Air:** Server’s `grade` is lowercase (e.g., `"good"`); UI expects uppercase enums (e.g., `"GOOD"`).
* **No normalization:** The frontend forwarded raw server JSON straight into presentational components, which rely on UI‑level types.

---

## 5) Solution Options

### Option A (Adopted): Frontend Normalization Layer

* Map server response → UI types in `getBriefing()`.
* Pros: Minimal blast radius; no server change; fastest to ship.
* Cons: Duplicate knowledge of server schema in frontend; needs updates when server changes.

### Option B: Refactor UI to Consume Server Schema

* Teach UI to select `traffic.car || expressway || transit` and handle nested shapes.
* Pros: Fewer transformations; UI closer to backend contract.
* Cons: Requires wider UI changes and type updates across multiple components.

---

## 6) Implementation (Option A)

Add a normalization function in `src/lib/api.ts`.

```ts
// src/lib/api.ts

type ServerBriefing = any; // keep flexible or define a precise type later

function normalizeBriefing(server: ServerBriefing) {
  // 1) Choose a traffic mode to display (priority: car → expressway → transit)
  const pick = server?.traffic?.car
    ?? server?.traffic?.expressway
    ?? server?.traffic?.transit
    ?? null;

  const traffic = pick ? {
    source: pick.source,                 // 'tmap' | 'expressway'
    source_status: pick.source_status,   // 'ok' | 'missing_api_key' | ...
    updated_at: pick.updated_at,
    eta_minutes: pick.eta_minutes,
    duration_seconds: pick.duration_seconds,
    distance_km: pick.distance_km,
    congestion_level: pick.congestion_level,
    // Optionally expose steps if UI wants to show a collapsible list
    steps: pick.steps,
  } : null;

  // 2) Weather mapping (condition/temp_c → sky/temp)
  const skyMap: Record<string, 'SUNNY'|'CLOUDY'|'RAINY'|'SNOW'|'FOG'|undefined> = {
    clear: 'SUNNY', sunny: 'SUNNY',
    cloudy: 'CLOUDY', overcast: 'CLOUDY',
    rain: 'RAINY', rainy: 'RAINY', shower: 'RAINY',
    snow: 'SNOW', fog: 'FOG', mist: 'FOG',
  };
  const weather = server?.weather ? {
    source_status: server.weather.source_status,
    sky: skyMap[String(server.weather.condition ?? '').toLowerCase()],
    temp: server.weather.temp_c,
    pop: server.weather.pop, // probability of precipitation
    note: server.weather.notes?.[0],
  } : null;

  // 3) Air mapping (lowercase grade → uppercase enum)
  const air = server?.air ? {
    source_status: server.air.source_status,
    pm10: server.air.pm10,
    pm25: server.air.pm25,
    aqi: server.air.aqi,
    grade: String(server.air.grade ?? '').toUpperCase(), // e.g., 'GOOD'
    note: server.air.notes?.[0],
  } : null;

  return {
    summary: server?.summary,
    notices: server?.notices,
    from: server?.from,
    to: server?.to,
    traffic: traffic ?? undefined,
    weather: weather ?? undefined,
    air: air ?? undefined,
  };
}

export async function getBriefing(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE_URL}/briefing?${qs}`);
  if (!res.ok) throw new Error(`Briefing request failed: ${res.status}`);
  const raw = await res.json();
  return normalizeBriefing(raw);
}
```

**UI changes:** None required if components already consume the UI‑level `Briefing` shape (flattened fields). Optionally, render `traffic.steps` in a details panel.

---

## 7) API Contract Snapshot (Server → Frontend)

**Server (current)**

```json
{
  "summary": "Clear 22°C · Car 29m · Transit 39m · Air good",
  "traffic": {
    "car": {
      "eta_minutes": 29,
      "distance_km": 12.3,
      "steps": [ {"type": "drive", "name": "…", "duration_min": 3}, … ],
      "source": "tmap",
      "source_status": "ok"
    },
    "transit": { "source_status": "missing_api_key", "eta_minutes": 39 },
    "expressway": { "source_status": "missing_api_key", "eta_minutes": 33 }
  },
  "weather": { "condition": "clear", "temp_c": 22, "pop": 0.3, "source_status": "missing_api_key" },
  "air": { "grade": "good", "pm10": 22, "pm25": 12, "source_status": "missing_api_key" }
}
```

**Frontend (expected by UI components) after normalization**

```json
{
  "summary": "Clear 22°C · Car 29m · Transit 39m · Air good",
  "traffic": {
    "eta_minutes": 29,
    "distance_km": 12.3,
    "source": "tmap",
    "source_status": "ok"
  },
  "weather": {
    "sky": "SUNNY",
    "temp": 22,
    "pop": 0.3,
    "source_status": "missing_api_key"
  },
  "air": {
    "grade": "GOOD",
    "pm10": 22,
    "pm25": 12,
    "source_status": "missing_api_key"
  }
}
```

---

## 8) Testing & Acceptance Criteria

* **API smoke test**

  ```bash
  curl -G "http://localhost:8080/api/v1/briefing" \
    --data-urlencode "from=강남역" \
    --data-urlencode "to=서울역" | jq '{summary, traffic: .traffic.car.eta_minutes, weather: .weather.temp_c, air: .air.pm25}'
  ```
* **UI inspection**

  * Summary banner shows combined text.
  * Traffic card shows **ETA minutes** and **distance**.
  * Weather card shows **icon/sky** and **temperature**.
  * Air card shows **grade badge** and **PM10/PM2.5**.
* **Edge cases**

  * `traffic.car` missing → fallback to `expressway` or `transit`.
  * Server returns lowercase/unknown `condition` → safe default mapping in `skyMap`.
  * Missing keys do not break rendering (undefined guarded).

---

## 9) Rollback Plan

* Revert the normalization function call in `getBriefing()` to return raw server JSON (pre‑fix behavior). No DB migrations or server changes involved.

---

## 10) Future Work / Hardening

* **Contract alignment:** Publish a shared TypeScript schema/package for `BriefingResponse` and UI types.
* **E2E tests:** Add Playwright tests covering `from/to` inputs and card render assertions.
* **Feature flags:** Toggle alternative traffic source selection (e.g., expressway under congestion) at runtime.
* **i18n:** Map `condition → sky` with locale‑aware icons/text.

---

## 11) FAQ

**Q. Why not fix the server instead?**
A. The server schema already supports multiple modes and will be needed by other clients. Normalization on the UI is the least disruptive change today.

**Q. What if we later enable transit live data?**
A. The normalization priority list (`car → expressway → transit`) can be made configurable. UI can also surface mode tabs.

**Q. Can we show steps?**
A. Yes. `traffic.steps` is preserved in the normalized payload; wire it to a collapsible details panel.
