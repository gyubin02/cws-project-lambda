# A‑Plan Implementation Guide — Make **Briefing** behave like **City Commute** (Front‑end only)

This guide makes the **main page briefing card** render just like the City Commute page **without any extra API calls**. We will:

1. extend the client `normalizeBriefing()` to expose **both** `car` and `transit` plus `recommendation`, while keeping the legacy single `traffic` field for backward compatibility; and
2. change `src/pages/Index.tsx` to render **RecommendationBanner + EtaCompareCard** (and **TollgatePanel** when the selected mode is `car`), reusing the same UI flow as `TravelPage.tsx`.

Server **does not change**.

> ✅ Files we will touch:
>
> * `src/lib/api.ts` (client normalization of `/briefing`)
> * `src/pages/Index.tsx` (render logic and minor state plumbing)
>
> ℹ️ We will reuse existing components already used by City Commute: `ModeSelector`, `EtaCompareCard`, `RecommendationBanner`, `TollgatePanel` from `src/components/travel/*`.

---

## 0) Type shapes used by City Commute (reference)

These are already available from `/api/v1/traffic/city` and (per current backend) present in `/briefing` under `traffic.car`, `traffic.transit`, and `recommendation`. We’ll pass them through to the front-end view model.

```ts
// CarBrief / TransitBrief shape reference (already provided by server)
type CarBrief = {
  source: 'tmap';
  source_status: any; // "ok" | ...
  updated_at: string;
  mode: 'car';
  eta_minutes?: number;
  distance_km?: number;
  congestion_level?: 'LOW' | 'MID' | 'HIGH';
  steps?: Array<{ type:'drive'|'walk'|'bike'|'metro'|'bus'; name?: string; duration_min?: number }>;
  polyline?: { type:'LineString'; coordinates: [number,number][] };
  tollgates?: Array<{
    code: string; name: string; lat: number; lon: number;
    congestion?: 'SMOOTH' | 'MODERATE' | 'CONGESTED' | 'BLOCKED';
    speed_kph?: number; updated_at?: string; source?: string;
  }>;
};

type TransitBrief = {
  source: 'tmap';
  source_status: any; // "ok" | ...
  updated_at: string;
  mode: 'transit';
  eta_minutes?: number;
  distance_km?: number;
  fare_krw?: number;
  transfers?: number;
  steps?: Array<{ type:'metro'|'bus'|'walk'|'bike'|'drive'; name?: string; duration_min?: number }>;
};

type Recommendation = {
  mode: 'car' | 'transit' | 'tie';
  delta_min?: number;
  reasons?: string[];
  reason?: string;
};
```

---

## 1) **Patch `src/lib/api.ts`** — extend `normalizeBriefing()`

**Goal:** Keep the legacy `briefing.traffic` single selection while **also** exposing `briefing.traffic_modes = { car, transit }` and `briefing.recommendation` from the server response.

### 1‑A) Locate `normalizeBriefing()` and the single-pick line

Open `src/lib/api.ts` and find this exact code (it may span one line):

```ts
const pickTraffic = server.traffic?.car ?? server.traffic?.expressway ?? server.traffic?.transit ?? null;
```

### 1‑B) Replace it with the new selection + pass‑through block

**Delete the line above** and paste the following block **in its place**, keeping surrounding variables intact:

```ts
// Pull through both modes from /briefing as provided by the server
const car = server.traffic?.car ?? null;
const transit = server.traffic?.transit ?? null;

// Server may include recommendation either under server.traffic or top-level; prefer traffic-level
const recommendation = (server.traffic && 'recommendation' in server.traffic)
  ? (server.traffic as any).recommendation
  : (server as any).recommendation ?? null;

// Keep legacy single-pick for backward compatibility (old TrafficCard consumers)
const pickTraffic = car ?? server.traffic?.expressway ?? transit ?? null;

// Attach new fields onto the normalized view-model object
// NOTE: Insert these into the object you return from normalizeBriefing()
extra.briefingExtensions = {
  traffic_modes: { car, transit },
  recommendation: recommendation ?? null,
};
```

> **Important:** Your `normalizeBriefing()` likely returns an object like `{ ... }`. Ensure you **spread** the two new fields into that return value. For example, inside the function’s final `return`:
>
> ```ts
> return {
>   ...existing,                  // whatever you already return
>   traffic: pickTraffic,         // keep for legacy
>   traffic_modes: extra.briefingExtensions.traffic_modes,
>   recommendation: extra.briefingExtensions.recommendation,
> };
> ```
>
> If you don’t have an `extra` helper object, just inline the two properties directly.

### 1‑C) (Optional but recommended) Add lightweight types in this file

Append near the top or bottom of `src/lib/api.ts`:

```ts
export type BriefingTrafficModes = {
  car?: CarBrief | null;
  transit?: TransitBrief | null;
};
```

If this file does not have access to `CarBrief` / `TransitBrief` types, you can import them from where the City page uses them (often `src/types/traffic` or similar). If not present, you can temporarily type them as `any` to keep the patch minimal.

---

## 2) **Patch `src/pages/Index.tsx`** — render City‑style UI on the main page

**Goal:** Replace the single `TrafficCard` usage with the City Commute composition:

* Respect **user’s selected mode** (from `ModeSelector` or URL `?mode=car|transit`).
* If the backend `recommendation.mode` differs from the user’s selected mode, show **RecommendationBanner**.
* Show **EtaCompareCard** side‑by‑side ETAs.
* If user selected `car`, render **TollgatePanel** with `car.tollgates`.

### 2‑A) Add imports

At the **top** of `src/pages/Index.tsx`, add these lines (keep existing imports):

```tsx
import { useMemo, useState } from 'react';
import { RecommendationBanner } from '@/components/travel/RecommendationBanner';
import { EtaCompareCard } from '@/components/travel/EtaCompareCard';
import { TollgatePanel } from '@/components/travel/TollgatePanel';
import { ModeSelector } from '@/components/travel/ModeSelector';
```

> If your project uses relative paths instead of `@/`, mirror whatever `TravelPage.tsx` uses for these imports.

### 2‑B) Capture and keep **selected mode**

Find where your page keeps the search state (from/to). Right below the existing state hooks, **add**:

```tsx
const url = new URL(window.location.href);
const initialMode = (url.searchParams.get('mode') === 'transit') ? 'transit' : 'car';
const [selectedMode, setSelectedMode] = useState<'car'|'transit'>(initialMode);
```

If your `SearchForm` already manages mode via `ModeSelector`, ensure `onSubmit` also calls `setSelectedMode(values.mode)` or the URL carries `?mode=...` so the state above stays in sync. A minimal wiring (near your search submit handler):

```tsx
const handleSubmit = (values: { from: string; to: string; mode?: 'car'|'transit' }) => {
  if (values.mode) setSelectedMode(values.mode);
  // existing submit flow (trigger fetchBriefing etc.)
};
```

### 2‑C) Pull `car`, `transit`, `recommendation` from briefing

Where you read the normalized briefing payload, define these memoized helpers **before the render JSX**:

```tsx
// Suppose `briefing` is what normalizeBriefing() returned
const car = useMemo(() => briefing?.traffic_modes?.car ?? null, [briefing]);
const transit = useMemo(() => briefing?.traffic_modes?.transit ?? null, [briefing]);
const recommendation = useMemo(() => briefing?.recommendation ?? null, [briefing]);

const recommendedMode: 'car'|'transit'|'tie'|null = recommendation?.mode ?? null;
const showBanner = recommendedMode && recommendedMode !== selectedMode && recommendedMode !== 'tie';
```

> If your data sits under a different variable name (e.g., `data.briefing`), adjust accordingly.

### 2‑D) **Replace the single TrafficCard render** with the City composition

Find the **existing** single-card render. It will look like one of:

```tsx
<TrafficCard traffic={briefing.traffic} />
```

or

```tsx
{briefing?.traffic && (
  <TrafficCard traffic={briefing.traffic} />
)}
```

**Delete** that block and paste the following **in the same place**:

```tsx
{/* City-style transport UI */}
{(car || transit) ? (
  <>
    {/* 1) Suggest the faster mode when user preference differs */}
    {showBanner && (
      <RecommendationBanner
        preferred={selectedMode}
        recommended={recommendedMode as 'car'|'transit'}
        reason={recommendation?.reason}
        reasons={recommendation?.reasons}
        deltaMin={recommendation?.delta_min}
      />
    )}

    {/* 2) Side-by-side comparison */}
    <EtaCompareCard
      car={car || undefined}
      transit={transit || undefined}
      selected={selectedMode}
      recommended={recommendedMode as 'car'|'transit' | undefined}
    />

    {/* 3) Tollgate panel for car selection */}
    {(selectedMode === 'car' && car?.tollgates && car.tollgates.length > 0) && (
      <TollgatePanel tollgates={car.tollgates} />
    )}
  </>
) : (
  // Fallback to legacy single card if no dual-mode data present
  briefing?.traffic ? <TrafficCard traffic={briefing.traffic} /> : null
)}
```

> **Props note:** The snippet matches the typical props used on the City page. If your `EtaCompareCard` or `RecommendationBanner` props differ, copy the exact prop names from `src/pages/TravelPage.tsx` where they are already used, and mirror them here.

### 2‑E) (Optional) Render/keep the **ModeSelector** in the hero/search area

If `Index.tsx` doesn’t already show `ModeSelector`, place it near the SearchForm so users can choose their preferred mode on the main page (same as City Commute):

```tsx
<ModeSelector value={selectedMode} onChange={setSelectedMode} />
```

Make sure your `SearchForm` uses that value (or writes `?mode=...`) so the server sees the user’s preference when you next route to the City page; for **A‑Plan** the UI is driven entirely from `/briefing`, so this is mainly for consistency.

---

## 3) No changes to server

Back-end already computes both modes via `trafficService.getAggregatedCityTraffic()` and includes `recommendation`. We only surfaced those fields in the client normalization and rendered them.

---

## 4) Build & Smoke Test

### 4‑A) Local build

```bash
# from project root
pnpm install   # or npm/yarn as your repo uses
pnpm dev       # run dev server
```

### 4‑B) UI manual test (using the sample addresses)

1. Open the main page (`/`).
2. In the search inputs, set:

   * **From**: `서울특별시 중구 세종대로 110`
   * **To**: `서울특별시 송파구 올림픽로 300`
   * **Preferred mode**: try **Car** first, then **Transit**.
3. Click **“브리핑 받기”**.
4. Expected:

   * If both `car` and `transit` came through in `/briefing`, you’ll see **EtaCompareCard**.
   * If the server’s `recommendation.mode` ≠ your selected mode, a **RecommendationBanner** appears suggesting the faster option.
   * When **Car** is selected and `car.tollgates` is non‑empty, the **TollgatePanel** appears showing route tollgate congestion.
   * If only one mode arrives (e.g., degraded/mocked), you fall back to the legacy **TrafficCard**.

> Tip: Your backend supports MOCK/fallbacks. To quickly simulate states, toggle `MOCK=1` or force one mode to be slower/faster in fixtures so you can see the banner appear/disappear.

### 4‑C) API spot check (optional)

You don’t need extra endpoints, but you can verify `/briefing` already contains both modes:

```bash
curl -s "http://localhost:8787/api/v1/briefing?from=서울특별시 중구 세종대로 110&to=서울특별시 송파구 올림픽로 300" | jq '.traffic | {car: has("car"), transit: has("transit"), recommendation: .recommendation}'
```

You should see `car: true`, `transit: true` when both are available.

---

## 5) Checklist & Pitfalls

* [ ] `normalizeBriefing()` returns **both** `traffic_modes` and `recommendation` **and** keeps `traffic` for legacy.
* [ ] `Index.tsx` imports **RecommendationBanner**, **EtaCompareCard**, **TollgatePanel**, **ModeSelector**.
* [ ] `selectedMode` is derived from URL `?mode=` or SearchForm, and updates when users switch.
* [ ] Banner shows **only** when `recommendedMode` is `car` or `transit` and differs from `selectedMode` (ignore `tie`).
* [ ] `EtaCompareCard` receives `car` and `transit` objects **untouched**.
* [ ] `TollgatePanel` renders only if `selectedMode === 'car'` **and** there are tollgates.
* [ ] Legacy **TrafficCard** still renders if dual-mode data is missing.

Common pitfalls:

* Forgetting to **return** the new fields from `normalizeBriefing()` (UI sees `undefined`).
* Import paths not matching your alias config. Mirror the paths used in `TravelPage.tsx`.
* Passing the wrong props to `EtaCompareCard`/`RecommendationBanner`. Copy **exact usage** from `TravelPage.tsx`.

---

## 6) Commit message & PR blurb

**Commit message**

```
feat(briefing-ui): render City-style comparison on main page w/o extra calls

- extend normalizeBriefing() to expose traffic_modes {car, transit} + recommendation
- keep legacy briefing.traffic selection for backward compatibility
- Index.tsx: reuse RecommendationBanner + EtaCompareCard; show TollgatePanel for car
- preserve legacy TrafficCard as fallback when dual-mode data missing
```

**PR description (paste-ready)**

```
## What
Main page briefing now mirrors City Commute UI without calling /traffic/city.

## How
- Client-only change: normalizeBriefing() now passes through car+transit and recommendation; keeps legacy single traffic
- Index.tsx swaps single TrafficCard for the City composition:
  - RecommendationBanner if user-preferred mode is slower (non-tie)
  - EtaCompareCard to show both ETAs side-by-side
  - TollgatePanel appears when selected mode is car and tollgates are present

## Why
- Unifies transport UX across main and City pages
- Avoids extra network hop (A-plan)
- Preserves backward compatibility with existing single-card consumers

## Test
- Manual with sample addresses
- Verified dual-mode present in /briefing and banner toggles as expected under mock/live
```

---

## 7) Revert plan

If needed, revert the UI by restoring the single `<TrafficCard traffic={briefing.traffic} />` block in `Index.tsx` and remove the extra return fields from `normalizeBriefing()`.

---

**Done.** The main page briefing now behaves like City Commute using `/briefing` only, showing dual-mode ETAs, recommendations, and car tollgate congestion when relevant.
