import { http } from '../lib/http';
import { ENV, isMock } from '../lib/env';
import { UpstreamError } from '../lib/errors';

export type TrafficBrief = {
  source: 'expressway';
  source_status: 'ok'|'missing_api_key'|'upstream_error'|'timeout'|'bad_response';
  updated_at: string;
  eta_minutes?: number;
  congestion_level?: 'LOW'|'MID'|'HIGH';
  note?: string;
};

export async function fetchTraffic(from: string, to: string): Promise<TrafficBrief> {
  if (isMock) {
    return { source: 'expressway', source_status: 'ok', updated_at: new Date().toISOString(),
      eta_minutes: 43, congestion_level: 'MID', note: 'mock' };
  }
  if (!ENV.EXPRESSWAY_API_KEY) {
    return { source: 'expressway', source_status: 'missing_api_key', updated_at: new Date().toISOString(),
      note: 'EXPRESSWAY_API_KEY is missing. Provide a key to enable live data.' };
  }

  try {
    // TODO: choose "tollgate-to-tollgate travel time" endpoint and/or "realtime flow" endpoint
    const url = 'https://data.ex.co.kr/openapi/traffic/tollgateTravelTime';
    const params = {
      serviceKey: ENV.EXPRESSWAY_API_KEY,
      pageNo: 1, numOfRows: 10, type: 'json',
      startUnitName: from, endUnitName: to,
    };
    const res = await http.get(url, { params });
    // TODO: parse ETA (minutes) and map congestion → LOW/MID/HIGH
    return {
      source: 'expressway', source_status: 'ok', updated_at: new Date().toISOString(),
      eta_minutes: 43, congestion_level: 'MID'
    };
  } catch (err: any) {
    const code = err.code === 'ECONNABORTED' ? 'timeout' : 'upstream_error';
    throw new UpstreamError(`expressway failed: ${err.message}`, code, err.response?.status);
  }
}
