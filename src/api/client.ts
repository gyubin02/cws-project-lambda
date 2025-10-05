const BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let payload: unknown;
    try {
      payload = text ? JSON.parse(text) : undefined;
    } catch {
      payload = { error: "unknown_error", message: text };
    }
    throw { status: res.status, ...(payload as object) };
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export const api = {
  getProfile: <T>(userId: string) => request<T>(`/profile?user_id=${encodeURIComponent(userId)}`),
  saveProfile: <T>(profile: unknown) => request<T>(`/profile`, { method: "POST", body: JSON.stringify(profile) }),
  getBriefing: <T>(userId: string) => request<T>(`/briefing?user_id=${encodeURIComponent(userId)}`),
  getSettings: <T>() => request<T>(`/settings`),
  saveSettings: <T>(payload: unknown) => request<T>(`/settings`, { method: "POST", body: JSON.stringify(payload) }),
};

export type ApiError = {
  status: number;
  error?: string;
  issues?: unknown;
  message?: string;
};
