import type { CarBrief, CityTraffic, TransitBrief } from '../types/traffic';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const TRAFFIC_BASE = `${API_BASE_URL.replace(/\/+$/, '')}/traffic`;

type CoordinatePair = [number, number];

const toQueryCoords = (coords: CoordinatePair): string => `${coords[0]},${coords[1]}`;

const buildQuery = (params: { from: CoordinatePair; to: CoordinatePair; at?: string }): URLSearchParams => {
  const query = new URLSearchParams();
  query.set('from', toQueryCoords(params.from));
  query.set('to', toQueryCoords(params.to));
  if (params.at) {
    query.set('at', params.at);
  }
  return query;
};

async function parseJson<T>(res: Response, context: string): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `${context} request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function fetchCity(params: { from: CoordinatePair; to: CoordinatePair; at?: string }): Promise<CityTraffic> {
  const query = buildQuery(params);
  const res = await fetch(`${TRAFFIC_BASE}/city?${query.toString()}`);
  const payload = await parseJson<{ ok?: boolean; data?: CityTraffic }>(res, 'City traffic');
  if (payload?.data) {
    return payload.data;
  }
  if (payload && payload.ok === false) {
    throw new Error('City traffic request failed');
  }
  throw new Error('City traffic response missing data');
}

export async function fetchCar(params: { from: CoordinatePair; to: CoordinatePair; at?: string }): Promise<CarBrief> {
  const query = buildQuery(params);
  const res = await fetch(`${TRAFFIC_BASE}/car?${query.toString()}`);
  return parseJson<CarBrief>(res, 'Car traffic');
}

export async function fetchTransit(params: { from: CoordinatePair; to: CoordinatePair; at?: string }): Promise<TransitBrief> {
  const query = buildQuery(params);
  const res = await fetch(`${TRAFFIC_BASE}/transit?${query.toString()}`);
  return parseJson<TransitBrief>(res, 'Transit traffic');
}
