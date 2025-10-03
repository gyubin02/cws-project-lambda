import { http } from '../lib/http';
import { ENV, isMock } from '../lib/env';
import { UpstreamError } from '../lib/errors';

// Minimal normalized shape (extend to match your OpenAPI)
export type KmaWeather = {
  source: 'kma';
  source_status: 'ok'|'missing_api_key'|'upstream_error'|'timeout'|'bad_response';
  updated_at: string;
  sky?: 'SUNNY'|'CLOUDY'|'RAINY';
  tmin_c?: number;
  tmax_c?: number;
  note?: string;
};

// Example: convert lat/lon to KMA grid (stub; replace with your util if already present)
function toKmaGrid(lat: number, lon: number) {
  // TODO: real LCC conversion → return { nx, ny }
  return { nx: 60, ny: 127 };
}

export async function fetchKmaWeather(lat: number, lon: number): Promise<KmaWeather> {
  if (isMock) {
    return { source: 'kma', source_status: 'ok', updated_at: new Date().toISOString(),
      sky: 'SUNNY', tmin_c: 17, tmax_c: 24, note: 'mock' };
  }
  if (!ENV.KMA_SERVICE_KEY) {
    return { source: 'kma', source_status: 'missing_api_key', updated_at: new Date().toISOString(),
      note: 'KMA_SERVICE_KEY is missing. Provide a key to enable live data.' };
  }

  try {
    const { nx, ny } = toKmaGrid(lat, lon);
    // TODO: fill in actual endpoint + params (getVilageFcst/getUltraSrtFcst)
    const url = 'http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst';
    const params = {
      serviceKey: ENV.KMA_SERVICE_KEY, dataType: 'JSON',
      base_date: '20241003', base_time: '0800', nx, ny, pageNo: 1, numOfRows: 500,
    };

    const res = await http.get(url, { params });
    // TODO: parse and map SKY/TMX/TMN from KMA categories
    return {
      source: 'kma',
      source_status: 'ok',
      updated_at: new Date().toISOString(),
      sky: 'SUNNY',
      tmin_c: 17,
      tmax_c: 24,
    };
  } catch (err: any) {
    const code = err.code === 'ECONNABORTED' ? 'timeout' : 'upstream_error';
    throw new UpstreamError(`kma failed: ${err.message}`, code, err.response?.status);
  }
}
