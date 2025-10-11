import type { CarBrief, CityTraffic, TransitBrief } from '../types/traffic';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const TRAFFIC_BASE = `${API_BASE_URL.replace(/\/+$/, '')}/traffic`;

type TrafficQueryParams = {
  from: string;
  to: string;
  at?: string;
  signal?: AbortSignal;
};

const buildQuery = ({ from, to, at }: TrafficQueryParams): URLSearchParams => {
  const query = new URLSearchParams();
  query.set('from', from);
  query.set('to', to);
  if (at) {
    query.set('at', at);
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

export async function fetchCity(params: TrafficQueryParams): Promise<CityTraffic> {
  const { signal, ...rest } = params;
  const query = buildQuery(rest);
  const res = await fetch(`${TRAFFIC_BASE}/city?${query.toString()}`, { signal });
  const payload = await parseJson<{ ok?: boolean; data?: CityTraffic }>(res, 'City traffic');
  if (payload?.data) {
    return payload.data;
  }
  if (payload && payload.ok === false) {
    throw new Error('City traffic request failed');
  }
  throw new Error('City traffic response missing data');
}

export async function fetchCar(params: TrafficQueryParams): Promise<CarBrief> {
  const { signal, ...rest } = params;
  const query = buildQuery(rest);
  const res = await fetch(`${TRAFFIC_BASE}/car?${query.toString()}`, { signal });
  return parseJson<CarBrief>(res, 'Car traffic');
}

export async function fetchTransit(params: TrafficQueryParams): Promise<TransitBrief> {
  const { signal, ...rest } = params;
  const query = buildQuery(rest);
  const res = await fetch(`${TRAFFIC_BASE}/transit?${query.toString()}`, { signal });
  return parseJson<TransitBrief>(res, 'Transit traffic');
}
