import { http } from '../lib/http';
import { ENV, isMock } from '../lib/env';
import { UpstreamError } from '../lib/errors';
import { AirKoreaData } from '../types';

export type AirQuality = {
  source: 'airkorea';
  source_status: 'ok'|'missing_api_key'|'upstream_error'|'timeout'|'bad_response';
  updated_at: string;
  pm10?: number; pm25?: number;
  grade?: 'GOOD'|'MODERATE'|'BAD'|'VERY_BAD';
  note?: string;
};

export class AirKoreaAdapter {
  async getAirQualityData(_district: string | undefined, _lat: number, _lon: number): Promise<AirKoreaData> {
    if (isMock) {
      return {
        pm10: 22,
        pm25: 12,
        grade: 'good',
        advice: '공기질이 매우 좋습니다. 야외 활동하기 완벽한 날입니다.',
      };
    }

    if (!ENV.AIRKOREA_SERVICE_KEY) {
      throw new UpstreamError('AirKorea API key missing', 'missing_api_key');
    }

    try {
      // TODO (simple): getCtprvnRltmMesureDnsty?sidoName=서울
      // TODO (accurate): station lookup (getNearbyMsrstnList) → getMsrstnAcctoRltmMesureDnsty
      const url = 'http://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty';
      const params = {
        serviceKey: ENV.AIRKOREA_SERVICE_KEY,
        returnType: 'json', pageNo: 1, numOfRows: 100,
        sidoName: '서울',
      };
      await http.get(url, { params });
      // TODO: parse PM10/PM2.5 and compute grade threshold
      return {
        pm10: 22,
        pm25: 12,
        grade: 'good',
        advice: '공기질이 매우 좋습니다. 야외 활동하기 완벽한 날입니다.',
      };
    } catch (err: any) {
      const code = err.code === 'ECONNABORTED' ? 'timeout' : 'upstream_error';
      throw new UpstreamError(`airkorea failed: ${err.message}`, code, err.response?.status);
    }
  }
}

// Keep the function export for backward compatibility
export async function fetchAirQuality(_lat: number, _lon: number): Promise<AirQuality> {
  if (isMock) {
    return { source: 'airkorea', source_status: 'ok', updated_at: new Date().toISOString(),
      pm10: 22, pm25: 12, grade: 'GOOD', note: 'mock' };
  }
  if (!ENV.AIRKOREA_SERVICE_KEY) {
    return { source: 'airkorea', source_status: 'missing_api_key', updated_at: new Date().toISOString(),
      note: 'AIRKOREA_SERVICE_KEY is missing. Provide a key to enable live data.' };
  }

  try {
    // TODO (simple): getCtprvnRltmMesureDnsty?sidoName=서울
    // TODO (accurate): station lookup (getNearbyMsrstnList) → getMsrstnAcctoRltmMesureDnsty
    const url = 'http://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty';
    const params = {
      serviceKey: ENV.AIRKOREA_SERVICE_KEY,
      returnType: 'json', pageNo: 1, numOfRows: 100,
      sidoName: '서울',
    };
    await http.get(url, { params });
    // TODO: parse PM10/PM2.5 and compute grade threshold
    return {
      source: 'airkorea',
      source_status: 'ok',
      updated_at: new Date().toISOString(),
      pm10: 22, pm25: 12, grade: 'GOOD',
    };
  } catch (err: any) {
    const code = err.code === 'ECONNABORTED' ? 'timeout' : 'upstream_error';
    throw new UpstreamError(`airkorea failed: ${err.message}`, code, err.response?.status);
  }
}
