# Location Handling Without Lat/Lon in UI — **Developer Guide**

**Goal:**
Users get a full **briefing** (traffic + weather + air quality) by entering **place names only**. The backend geocodes and **stores canonical coordinates** during user settings. The UI **never requires** raw latitude/longitude, but can still benefit from an optional “Coordinate Lock” (advanced) to ensure deterministic behavior and avoid extra geocoding calls.

This document is self-contained and assumes the current repo structure:

* **Backend:** `server/` (Express + TypeScript)
* **Frontend:** React/Vite/TS
* External data sources: **TMAP** (geocoding + car routing), **KMA** (weather), **AirKorea** (air), **Korea Expressway** (travel time)

---

## 1) Product Requirements (what “done” looks like)

1. **User Settings UX**

   * Users enter **place names** for *Default Origin* and *Default Destination*.
   * When saved, the backend **geocodes** and persists `(lat, lon)` for those names.
   * Optional toggle: **Coordinate Lock**

     * **ON**: Always use the stored `(lat, lon)`; ignore re-geocoding.
     * **OFF**: Use names → geocode on demand; stored coords are fallback only.

2. **Briefing Request UX**

   * UI sends **only** `from`, `to` (names or `"lat,lon"` strings).
   * **No** `lat`/`lon` fields are required in UI.
   * Backend resolves coordinates and returns the merged briefing (traffic + weather + air).

3. **/weather and /air (standalone)**

   * Short-term: accept `lat/lon` (current behavior) **or** a single `location` that can be a **place name** or `"lat,lon"`; backend geocodes when needed.
   * If Coordinate Lock is ON and stored coords exist, prefer them.

4. **Performance & Reliability**

   * Minimize geocoding calls (cache + lock).
   * Provide deterministic results when desired.
   * Graceful fallback when geocoder is down.

---

## 2) Data Model & Settings Contract

> Use your existing user settings store (DB, file, or KV). Below is a neutral DTO.

```ts
// server/src/types/settings.ts
export interface UserLocationSetting {
  name: string;            // e.g., "Gangnam Station"
  lat?: number;            // canonical coord resolved at save time
  lon?: number;            // canonical coord resolved at save time
  lastGeocodedAt?: string; // ISO timestamp
}

export interface UserSettings {
  defaultOrigin?: UserLocationSetting;
  defaultDestination?: UserLocationSetting;
  coordinateLock?: boolean; // true => use stored lat/lon; false => geocode at runtime
}
```

**Persistence rule:**

* On **save** of a name, call **TMAP geocode** synchronously:

  * If found → store both `name` and `(lat, lon) + lastGeocodedAt`.
  * If not found → reject with 400 (validation error).
* Coordinate Lock default: **false**.

---

## 3) Backend Changes

### 3.1 Geocoding utility (already present pattern)

* **Use existing** `parseCoordOrGeocode(value, geocodeFn)` flow:

  * If `value` matches `/^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/`, parse as coords.
  * Else call `geocodeFn(value)`.

> In this project, `tmapAdapter.geocode(query)` should return `{ lat, lon }`.

### 3.2 Settings endpoints

Create/extend settings routes so the **server resolves and stores** coordinates:

```ts
// server/src/routes/settings.routes.ts (new or extend)
import { z } from "zod";
import { tmapAdapter } from "../adapters/tmap.adapter";
import { saveUserSettings, getUserSettings } from "../services/settings.service";
import { Router } from "express";

const router = Router();

const LocationSchema = z.object({
  name: z.string().min(1),
});

const SettingsUpsertSchema = z.object({
  defaultOrigin: LocationSchema.optional(),
  defaultDestination: LocationSchema.optional(),
  coordinateLock: z.boolean().optional(),
});

router.get("/", async (req, res, next) => {
  try {
    const settings = await getUserSettings(req);
    res.json(settings ?? {});
  } catch (e) { next(e); }
});

router.post("/", async (req, res, next) => {
  try {
    const body = SettingsUpsertSchema.parse(req.body);
    const nextSettings: any = {};

    if (body.defaultOrigin?.name) {
      const c = await tmapAdapter.geocode(body.defaultOrigin.name);
      nextSettings.defaultOrigin = {
        name: body.defaultOrigin.name,
        lat: c.lat, lon: c.lon,
        lastGeocodedAt: new Date().toISOString(),
      };
    }
    if (body.defaultDestination?.name) {
      const c = await tmapAdapter.geocode(body.defaultDestination.name);
      nextSettings.defaultDestination = {
        name: body.defaultDestination.name,
        lat: c.lat, lon: c.lon,
        lastGeocodedAt: new Date().toISOString(),
      };
    }
    if (typeof body.coordinateLock === "boolean") {
      nextSettings.coordinateLock = body.coordinateLock;
    }

    const saved = await saveUserSettings(req, nextSettings);
    res.status(200).json(saved);
  } catch (e) { next(e); }
});

export default router;
```

> **Storage:** implement `saveUserSettings/getUserSettings` for your persistence layer.

### 3.3 Briefing route behavior

**Policy:**

* If **Coordinate Lock ON** and stored coords exist:
  use stored `(lat, lon)` for `origin`/`destination`.
* Else:
  try to resolve from request `from`/`to`:

  * If `"lat,lon"` → parse,
  * Else → geocode names.
  * If geocode fails → fallback to stored coords (if present).
  * If still missing → 400.

**Sketch:**

```ts
// server/src/routes/briefing.routes.ts (conceptual)
import { Router } from "express";
import { z } from "zod";
import { getUserSettings } from "../services/settings.service";
import { parseCoordOrGeocode } from "../lib/util";
import { tmapAdapter } from "../adapters/tmap.adapter";
import { makeBriefing } from "../services/briefing.service";

const router = Router();

const Q = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

router.get("/", async (req, res, next) => {
  try {
    const { from, to } = Q.parse(req.query);
    const settings = await getUserSettings(req);

    const useLocked = !!settings?.coordinateLock;
    const haveStoredFrom = !!settings?.defaultOrigin?.lat && !!settings?.defaultOrigin?.lon;
    const haveStoredTo   = !!settings?.defaultDestination?.lat && !!settings?.defaultDestination?.lon;

    let origin, destination;

    if (useLocked && haveStoredFrom) {
      origin = { lat: settings.defaultOrigin!.lat!, lon: settings.defaultOrigin!.lon! };
    } else if (from) {
      origin = await parseCoordOrGeocode(from, tmapAdapter.geocode);
    } else if (haveStoredFrom) {
      origin = { lat: settings.defaultOrigin!.lat!, lon: settings.defaultOrigin!.lon! }; // fallback
    }

    if (useLocked && haveStoredTo) {
      destination = { lat: settings.defaultDestination!.lat!, lon: settings.defaultDestination!.lon! };
    } else if (to) {
      destination = await parseCoordOrGeocode(to, tmapAdapter.geocode);
    } else if (haveStoredTo) {
      destination = { lat: settings.defaultDestination!.lat!, lon: settings.defaultDestination!.lon! }; // fallback
    }

    if (!origin || !destination) {
      return res.status(400).json({ error: "origin/destination required" });
    }

    const result = await makeBriefing({ origin, destination });
    res.json(result);
  } catch (e) { next(e); }
});

export default router;
```

> `makeBriefing` should already call weather/air/traffic using `origin` (and traffic uses both).

### 3.4 `/weather` and `/air` standalone: add `location` query (name or "lat,lon")

**New query contract** (backward compatible):

* `/weather?location=<name|lat,lon>` or `/weather?lat=..&lon=..`
* `/air?location=<name|lat,lon>` or `/air?lat=..&lon=..` (and/or `district` as today)

**Resolution order** (per endpoint):

1. If **Coordinate Lock ON** and stored coord exists → use stored coord (origin).
2. Else if `location` present → `parseCoordOrGeocode(location, geocode)`.
3. Else if `lat/lon` present → use them.
4. Else if stored coord exists → use stored coord.
5. Else → 400.

> Implement the same pattern as the briefing route for consistency.

---

## 4) Frontend Changes

### 4.1 Types

```diff
- export interface SearchParams {
-   lat: number;
-   lon: number;
-   from: string;
-   to: string;
- }
+ export interface SearchParams {
+   from: string; // place name or "lat,lon"
+   to: string;   // place name or "lat,lon"
+ }
```

**Settings model** (mirror backend DTO; optional local cache):

```ts
export interface UiUserSettings {
  defaultOriginName?: string;
  defaultDestinationName?: string;
  coordinateLock?: boolean;
  // Optionally show resolved coords returned by backend:
  resolvedOrigin?: { lat: number; lon: number };
  resolvedDestination?: { lat: number; lon: number };
}
```

### 4.2 Settings UI

* Inputs: **Origin name**, **Destination name**, **Coordinate Lock (toggle)**.
* On **Save** → POST to `/api/v1/settings` with `{ defaultOrigin: {name}, defaultDestination: {name}, coordinateLock }`.
* Display **read-only preview** of resolved coords returned by the server.
* Validation: non-empty names; show error if backend returns 400 (not found).

### 4.3 Briefing Form

* Remove lat/lon fields entirely.
* Submit only `{ from, to }` (strings).
* When **Coordinate Lock ON**, you may display a note: “Using saved coordinates; names ignored at runtime.”

### 4.4 Optional: Weather/Air standalone buttons

* Prefer calling `/weather?location=<originName>` and `/air?location=<originName>`.
  The backend will use lock or geocode or stored coords per policy.

---

## 5) OpenAPI Updates (snippets)

```yaml
# server/openapi.yaml (snippets)

paths:
  /settings:
    get:
      summary: Get user settings
      responses:
        '200':
          description: OK
    post:
      summary: Upsert user settings (geocodes and stores coords)
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                defaultOrigin:
                  type: object
                  properties: { name: { type: string } }
                defaultDestination:
                  type: object
                  properties: { name: { type: string } }
                coordinateLock: { type: boolean }
      responses:
        '200': { description: Saved }

  /briefing:
    get:
      summary: Integrated briefing (traffic + weather + air)
      parameters:
        - in: query
          name: from
          schema: { type: string }
          description: Place name or "lat,lon". Optional when Coordinate Lock is ON and stored origin exists.
        - in: query
          name: to
          schema: { type: string }
          description: Place name or "lat,lon". Optional when Coordinate Lock is ON and stored destination exists.
      responses:
        '200': { description: OK }
        '400': { description: origin/destination required }

  /weather:
    get:
      summary: Weather by location
      parameters:
        - in: query
          name: location
          schema: { type: string }
          description: Place name or "lat,lon". If absent, falls back to lat/lon or stored origin when lock ON.
        - in: query
          name: lat
          schema: { type: number }
        - in: query
          name: lon
          schema: { type: number }
      responses:
        '200': { description: OK }
        '400': { description: Location required }

  /air:
    get:
      summary: Air quality by location
      parameters:
        - in: query
          name: location
          schema: { type: string }
          description: Place name or "lat,lon". If absent, falls back to lat/lon or stored origin when lock ON.
        - in: query
          name: lat
          schema: { type: number }
        - in: query
          name: lon
          schema: { type: number }
        - in: query
          name: district
          schema: { type: string }
          description: Optional district/station name (legacy)
      responses:
        '200': { description: OK }
        '400': { description: Location required }
```

---

## 6) Caching, Quotas, and Determinism

* **Geocoding cache:**

  * Cache `(name → {lat,lon})` for 24h–7d with LRU eviction.
  * Keys should be normalized (trim, lowercased, whitespace collapsed).
* **Coordinate Lock:**

  * Guarantees deterministic results for weather/air/traffic.
  * Avoids geocoding quota on hot paths.
* **Fallback order:**

  * Lock coords → request `location` → request `lat/lon` → stored coords → error.

---

## 7) Error Handling & Status Codes

* **400 Bad Request:** invalid/missing parameters; geocode not found.
* **429 Too Many Requests:** propagate when provider quota exceeded.
* **503 Service Unavailable:** upstream geocoder outage; if stored coords exist, **use them** and return **200** with `meta.warnings = ["geocode_unavailable_used_stored_coords"]`.

**Response meta example:**

```json
{
  "data": { /* ... */ },
  "meta": {
    "origin": { "source": "stored|geocoded|request" },
    "destination": { "source": "stored|geocoded|request" },
    "warnings": ["geocode_unavailable_used_stored_coords"]
  }
}
```

---

## 8) Security & Abuse Hardening

* Rate-limit `/settings` and geocoding endpoints.
* Sanitize inputs (strip control chars, limit length ~128).
* Reject coordinates outside valid ranges (lat ±90, lon ±180).
* Log geocoding errors separately from user errors.

---

## 9) Test Plan (end-to-end)

1. **Settings Save (happy path)**

   * POST `/settings` with `{defaultOrigin:{name:"Gangnam Station"}, defaultDestination:{name:"Seoul Station"}}`
   * Expect 200 with resolved coords.
2. **Briefing with names**

   * GET `/briefing?from=Gangnam%20Station&to=Seoul%20Station`
   * Expect 200; meta.origin.source = `geocoded`.
3. **Briefing with Coordinate Lock ON**

   * POST `/settings` `{ coordinateLock: true }`
   * GET `/briefing?from=RandomName&to=RandomName`
   * Expect 200; meta.origin.source = `stored`.
4. **Weather/Air standalone with `location`**

   * GET `/weather?location=Gangnam%20Station` → 200
   * GET `/air?location=Gangnam%20Station` → 200
5. **Fallback to stored coords on geocoder outage**

   * Simulate geocode failure → `/briefing` returns 200 with `meta.warnings`.
6. **Validation**

   * POST `/settings` with unknown place → 400
   * `/briefing` with no from/to and no stored coords → 400

---

## 10) Example cURL

```bash
# Save settings (geocode + store)
curl -X POST http://localhost:3000/api/v1/settings \
  -H 'Content-Type: application/json' \
  -d '{"defaultOrigin":{"name":"Gangnam Station"}, "defaultDestination":{"name":"Seoul Station"}, "coordinateLock": false}'

# Briefing by names (no lat/lon needed)
curl "http://localhost:3000/api/v1/briefing?from=Gangnam%20Station&to=Seoul%20Station"

# Turn on lock
curl -X POST http://localhost:3000/api/v1/settings \
  -H 'Content-Type: application/json' \
  -d '{"coordinateLock": true}'

# Briefing ignoring names (uses stored coords)
curl "http://localhost:3000/api/v1/briefing?from=foo&to=bar"

# Weather/Air by single location
curl "http://localhost:3000/api/v1/weather?location=Gangnam%20Station"
curl "http://localhost:3000/api/v1/air?location=Gangnam%20Station"
```

---

## 11) Minimal Frontend Wiring

* **Settings screen**: inputs for origin/destination names + lock toggle; POST to `/settings`; render returned coords as read-only preview.
* **Briefing screen**: form with `from`, `to` **(strings only)**; call `/briefing?from=...&to=...`.
* **Standalone weather/air (optional)**: call `/weather?location=<originName>` and `/air?location=<originName>`.

**Developer note:** You can still pass `"lat,lon"` as `from`/`to`/`location` if you want to bypass geocoding for a specific request (useful in advanced scenarios or debugging).

---

## 12) Migration Checklist

* [ ] Remove `lat`/`lon` from UI types and forms.
* [ ] Add/extend `/settings` to geocode and persist coordinates.
* [ ] Update `/briefing` resolution order (lock → request → stored).
* [ ] Extend `/weather` and `/air` to accept `location` (name or `"lat,lon"`), plus lock fallback.
* [ ] Update OpenAPI docs.
* [ ] Add geocode caching and rate limits.
* [ ] Implement meta sources and warnings for observability.
* [ ] QA with the test plan above.

---

## 13) Edge Cases

* **Ambiguous place names**: geocoder returns multiple candidates → pick top-ranked. If you want UX clarity, re-prompt in settings to refine the name (out of scope for API).
* **Very small displacements**: users may want to fine-tune coordinates manually. Allow manual edit in settings as an advanced field (optional).
* **Internationalization**: ensure geocoder handles Korean names reliably; normalize inputs (NFC) and strip special whitespace.

---

### TL;DR

* UI **never needs** to ask for raw lat/lon.
* Backend **does** the geocoding at **settings time** (store canonical coords) and **request time** (when lock is OFF).
* Add a **Coordinate Lock** to maximize performance and determinism.
* Extend **/weather** and **/air** with a `location` parameter for name-based calls.
