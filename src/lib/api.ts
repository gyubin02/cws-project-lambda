import { Briefing, SearchParams } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export async function getBriefing(params: SearchParams): Promise<Briefing> {
  const url = new URL(`${API_BASE_URL}/briefing`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });

  const res = await fetch(url.toString(), { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Briefing request failed: ${res.status}`);
  }
  return res.json();
}

export async function getWeather(lat: number, lon: number) {
  const url = `${API_BASE_URL}/weather?lat=${lat}&lon=${lon}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather request failed: ${res.status}`);
  return res.json();
}

export async function getAirQuality(lat: number, lon: number) {
  const url = `${API_BASE_URL}/air?lat=${lat}&lon=${lon}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Air quality request failed: ${res.status}`);
  return res.json();
}

export async function getTraffic(from: string, to: string) {
  const url = `${API_BASE_URL}/traffic?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Traffic request failed: ${res.status}`);
  return res.json();
}

export async function getHealth() {
  const url = `${API_BASE_URL}/healthz`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}
