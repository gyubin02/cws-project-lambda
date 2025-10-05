# Frontend “User Settings” (Profile) — Developer Guide

This document explains how to add a **User Settings screen** to the existing project so users can **create/update** their profile and the backend can **consume** it for briefing. With this guide and the current repo state, you can build the UI end-to-end.

---

## 1) Background & Goals

* The backend already exposes a **file-backed profile API** (stores data in `server/.data/store.json`).
* You will implement a **single page** in the frontend that:

  1. Reads an existing profile by `user_id`
  2. Creates/updates a profile (persisted server-side)
  3. Offers helper actions (e.g., set current map/marker to lat/lon later, optional)
  4. Validates basic input and reports errors cleanly

> The **briefing** flow can then use just `user_id` (server resolves defaults from the saved profile).

---

## 2) Backend Contract (already implemented)

### Base URL (frontend)

* `VITE_API_BASE_URL` (e.g., `http://localhost:8787/api/v1` or `http://<EC2_PUBLIC_IP>/api/v1`)

### Endpoints

#### Create/Update Profile

* `POST {BASE}/profile`
* **Request (JSON)**

```json
{
  "user_id": "gyubin",
  "home": { "lat": 37.5665, "lon": 126.9780, "label": "Home", "district": "Jung-gu" },
  "work": { "lat": 37.4990, "lon": 127.0330, "label": "Campus" }
}
```

* **Rules**

  * `user_id`: required, non-empty string
  * `home`: required → `{ lat:number, lon:number, label?:string, district?:string }`
  * `work`: optional but recommended → `{ lat:number, lon:number, label?:string }`
* **Responses**

  * `200 OK` + saved profile JSON (echoed/normalized)
  * `400 Bad Request` with `{ error: "bad_request", issues: [...] }` if validation fails

#### Get Profile

* `GET {BASE}/profile?user_id=gyubin`
* **Responses**

  * `200 OK` + existing profile JSON
  * `404 Not Found` + `{ error: "not_found" }` if there is no profile
  * `400 Bad Request` if query is invalid

> The backend uses Zod for validation. It **never logs secrets** and stores data in `server/.data/store.json`.

#### (For verification) Build Briefing using Profile

* `GET {BASE}/briefing?user_id=gyubin`
* If the profile exists, server uses it to resolve defaults for origin/destination.

---

## 3) UI Requirements

### 3.1 Page Scope

* **Route**: `/settings` (or `/profile`)
* **Sections**

  * **Account**: `user_id` input (required)
  * **Home**: latitude, longitude, label, district (district is optional but supported by backend)
  * **Work**: latitude, longitude, label (optional section)
  * **Actions**: Load Profile, Save Profile, Reset Form
* **State**

  * `loading`, `saving`, `error`, `success` (toast or inline feedback)
* **Validation**

  * `user_id` required
  * `lat`, `lon` must be finite numbers; show human-friendly errors
* **Accessibility**

  * Labels connected to inputs (`<label htmlFor="...">`)
  * Keyboard-navigable controls, `aria-invalid` on invalid inputs
  * Error region with `role="alert"`

### 3.2 UX Flow

1. **Load**: User types `user_id` → press **Load** → calls `GET /profile?user_id=...`

   * 200 → populate form with server values
   * 404 → show “No profile found, create one” and keep user’s current inputs
2. **Edit**: User edits fields
3. **Save**: Press **Save** → `POST /profile` with the full payload

   * 200 → success toast
   * 400 → show field errors inline
4. **Test** (optional): Link to **“Test Briefing”**: `GET /briefing?user_id=...` (opens in a new tab or prints JSON in UI)

---

## 4) Types & DTOs (frontend)

Create `src/types/profile.ts`:

```ts
export type Coordinates = {
  lat: number;
  lon: number;
  label?: string;
  district?: string; // only used for "home"
};

export type WorkLocation = Omit<Coordinates, "district">;

export type UserProfile = {
  user_id: string;
  home: Coordinates;
  work?: WorkLocation;
};
```

---

## 5) API Client (frontend)

Create `src/api/client.ts`:

```ts
const BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let payload: any;
    try { payload = JSON.parse(text); } catch { payload = { error: "unknown_error", message: text }; }
    throw { status: res.status, ...payload };
  }
  return res.json() as Promise<T>;
}

export const api = {
  getProfile: <T>(userId: string) => request<T>(`/profile?user_id=${encodeURIComponent(userId)}`),
  saveProfile: <T>(profile: any) =>
    request<T>(`/profile`, { method: "POST", body: JSON.stringify(profile) }),
  getBriefing: <T>(userId: string) => request<T>(`/briefing?user_id=${encodeURIComponent(userId)}`),
};
```

---

## 6) React Page (example)

Create `src/features/profile/ProfilePage.tsx`:

```tsx
import { useState } from "react";
import { api } from "../../api/client";
import type { UserProfile } from "../../types/profile";

const emptyProfile: UserProfile = {
  user_id: "",
  home: { lat: 37.5665, lon: 126.9780, label: "", district: "" },
  work: { lat: 37.4990, lon: 127.0330, label: "" },
};

export default function ProfilePage() {
  const [form, setForm] = useState<UserProfile>(emptyProfile);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onChange = (path: string, value: string) => {
    setForm((cur) => {
      const next: any = structuredClone(cur);
      const seg = path.split(".");
      let target: any = next;
      for (let i = 0; i < seg.length - 1; i++) target = target[seg[i]];
      target[seg[seg.length - 1]] = value;
      return next;
    });
  };

  const parseNumber = (s: string) => {
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  };

  const validate = (): string[] => {
    const errs: string[] = [];
    if (!form.user_id?.trim()) errs.push("user_id is required");
    const hlat = form.home?.lat; const hlon = form.home?.lon;
    if (!Number.isFinite(hlat) || !Number.isFinite(hlon)) errs.push("Home lat/lon must be numbers");
    if (form.work) {
      const wlat = form.work.lat; const wlon = form.work.lon;
      if (!Number.isFinite(wlat) || !Number.isFinite(wlon)) errs.push("Work lat/lon must be numbers");
    }
    return errs;
  };

  const loadProfile = async () => {
    setError(null); setSuccess(null); setLoading(true);
    try {
      const p = await api.getProfile<UserProfile>(form.user_id.trim());
      setForm(p);
    } catch (e: any) {
      if (e?.status === 404) {
        setSuccess("No profile found — create a new one and Save.");
      } else {
        setError(e?.message || "Failed to load profile");
      }
    } finally { setLoading(false); }
  };

  const saveProfile = async () => {
    setError(null); setSuccess(null);
    const errs = validate();
    if (errs.length) { setError(errs.join("\n")); return; }
    setSaving(true);
    try {
      // Coerce numeric fields (in case values came from <input type="text">)
      const payload: UserProfile = {
        ...form,
        home: { ...form.home, lat: +form.home.lat, lon: +form.home.lon },
        work: form.work ? { ...form.work, lat: +form.work.lat, lon: +form.work.lon } : undefined,
      };
      const saved = await api.saveProfile<UserProfile>(payload);
      setForm(saved);
      setSuccess("Profile saved.");
    } catch (e: any) {
      if (e?.error === "bad_request" && e?.issues) {
        setError("Validation failed: " + JSON.stringify(e.issues));
      } else {
        setError(e?.message || "Failed to save profile");
      }
    } finally { setSaving(false); }
  };

  const testBriefing = async () => {
    setError(null); setSuccess(null); setLoading(true);
    try {
      const data = await api.getBriefing<any>(form.user_id.trim());
      setSuccess("Briefing fetched. Open console to inspect JSON.");
      console.log("Briefing:", data);
    } catch (e: any) {
      setError(e?.message || "Failed to fetch briefing");
    } finally { setLoading(false); }
  };

  return (
    <div className="mx-auto max-w-2xl p-4 space-y-6">
      <h1 className="text-2xl font-semibold">User Settings</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Account</h2>
        <div className="grid grid-cols-3 gap-3">
          <label className="col-span-1 self-center" htmlFor="user_id">User ID</label>
          <input id="user_id" className="col-span-2 border rounded p-2"
                 value={form.user_id} onChange={e => onChange("user_id", e.target.value)} />
        </div>
        <button className="border rounded px-4 py-2" onClick={loadProfile} disabled={loading || !form.user_id}>
          {loading ? "Loading..." : "Load"}
        </button>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Home</h2>
        <div className="grid grid-cols-3 gap-3">
          <label htmlFor="home_lat" className="self-center">Lat</label>
          <input id="home_lat" className="col-span-2 border rounded p-2"
                 value={form.home.lat} onChange={e => onChange("home.lat", e.target.value)} />
          <label htmlFor="home_lon" className="self-center">Lon</label>
          <input id="home_lon" className="col-span-2 border rounded p-2"
                 value={form.home.lon} onChange={e => onChange("home.lon", e.target.value)} />
          <label htmlFor="home_label" className="self-center">Label</label>
          <input id="home_label" className="col-span-2 border rounded p-2"
                 value={form.home.label ?? ""} onChange={e => onChange("home.label", e.target.value)} />
          <label htmlFor="home_district" className="self-center">District (optional)</label>
          <input id="home_district" className="col-span-2 border rounded p-2"
                 value={form.home.district ?? ""} onChange={e => onChange("home.district", e.target.value)} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Work (optional)</h2>
        <div className="grid grid-cols-3 gap-3">
          <label htmlFor="work_lat" className="self-center">Lat</label>
          <input id="work_lat" className="col-span-2 border rounded p-2"
                 value={form.work?.lat ?? ""} onChange={e => onChange("work.lat", e.target.value)} />
          <label htmlFor="work_lon" className="self-center">Lon</label>
          <input id="work_lon" className="col-span-2 border rounded p-2"
                 value={form.work?.lon ?? ""} onChange={e => onChange("work.lon", e.target.value)} />
          <label htmlFor="work_label" className="self-center">Label</label>
          <input id="work_label" className="col-span-2 border rounded p-2"
                 value={form.work?.label ?? ""} onChange={e => onChange("work.label", e.target.value)} />
        </div>
      </section>

      <div className="flex gap-3">
        <button className="border rounded px-4 py-2" onClick={saveProfile} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
        <button className="border rounded px-4 py-2" onClick={testBriefing} disabled={!form.user_id || loading}>
          Test Briefing
        </button>
        <button className="border rounded px-4 py-2" onClick={() => { setForm(emptyProfile); setError(null); setSuccess(null); }}>
          Reset
        </button>
      </div>

      {error && <div role="alert" className="text-red-600 whitespace-pre-wrap">{error}</div>}
      {success && <div className="text-green-700 whitespace-pre-wrap">{success}</div>}
    </div>
  );
}
```

Add a route in your app’s router (example):

```tsx
// src/routes.tsx or wherever your app mounts routes
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProfilePage from "./features/profile/ProfilePage";
import Home from "./Home";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home/>} />
        <Route path="/settings" element={<ProfilePage/>} />
      </Routes>
    </BrowserRouter>
  );
}
```

---

## 7) Environment & CORS

### Local (dev)

* `server/.env`:

  * `CORS_ORIGINS=http://localhost:5173` (or your dev port)
* `frontend .env`:

  * `VITE_API_BASE_URL=http://localhost:8787/api/v1`

### Deployed (EC2+S3)

* `server/.env`:

  * `CORS_ORIGINS=http://<YOUR-S3-WEBSITE-ENDPOINT>,http://localhost:5173`
* `frontend .env.production`:

  * `VITE_API_BASE_URL=http://<EC2_PUBLIC_IP>/api/v1`

---

## 8) Error Handling Cheat-Sheet

* **404 on GET /profile**: show “No profile found — create one and Save.”
* **400 on POST /profile**: display server validation `issues` if present.
* **Network/timeout**: show toast “Network error — try again.” (The server itself has live→fixture fallback for upstream providers; your profile calls are local so errors usually mean connectivity.)

---

## 9) i18n / A11y / Perf Notes

* **i18n**: isolate strings; prepare for Korean/English toggling later.
* **A11y**: use `<label htmlFor>`, `aria-invalid`, and `role="alert"` for errors.
* **Perf**: form is tiny; no need for heavy state libs. Keep functions stable with `useCallback` if you notice re-renders.

---

## 10) Testing (lightweight)

* **Manual**:

  * Start server (`pnpm -C server dev`) and frontend (`pnpm dev` at root).
  * Navigate to `/settings`, enter `user_id`, click **Load** (expect 404 for first time).
  * Fill Home/Work → **Save** (expect “Profile saved.”).
  * Reload page → **Load** (expect values to populate).
  * Click **Test Briefing** → Inspect console for JSON; you should see profile-based defaults.
* **E2E later (optional)**: add Playwright tests to assert POST/GET flows.

---

## 11) File Map (proposed)

```
src/
  api/
    client.ts
  features/
    profile/
      ProfilePage.tsx
  types/
    profile.ts
  routes.tsx (or App.tsx)
.env
.env.production
```

---

## 12) Done Criteria

* `/settings` renders a form for **user_id**, **home**, **work**.
* **Load** pulls existing profile or shows not-found message.
* **Save** validates inputs, persists to server, and shows success feedback.
* **Test Briefing** works with the saved `user_id`.
* Works locally and with **S3(Frontend) + EC2(Backend)** by only changing `.env.production` `VITE_API_BASE_URL`.

---
