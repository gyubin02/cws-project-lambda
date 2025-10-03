import { http } from '../lib/http';
import { ENV, isMock } from '../lib/env';
import { calculateAirGrade, getAirQualityAdvice } from '../lib/util';
import type { AirBrief } from '../types';

// TODO: Replace stub parsing with AirKorea realtime endpoints (add official doc citation + URL once available).

const STUB_PM10 = 22;
const STUB_PM25 = 12;

function deriveStatus(): AirBrief['source_status'] {
  return ENV.AIRKOREA_SERVICE_KEY ? 'ok' : 'missing_api_key';
}

function buildStubBrief(district?: string): AirBrief {
  const grade = calculateAirGrade(STUB_PM10, STUB_PM25);
  const status = deriveStatus();
  const brief: AirBrief = {
    source: 'airkorea',
    source_status: status,
    updated_at: new Date().toISOString(),
    pm10: STUB_PM10,
    pm25: STUB_PM25,
    grade,
    advice: getAirQualityAdvice(grade),
    notes: [
      status === 'missing_api_key'
        ? 'Using stub air quality data until AirKorea service key is configured.'
        : 'Stub data active. Replace with live AirKorea response parsing.',
    ],
  };

  if (district) {
    brief.district = district;
  }

  return brief;
}

export class AirKoreaAdapter {
  async getAirQualityData(_district: string | undefined, _lat: number, _lon: number): Promise<AirBrief> {
    if (isMock) {
      return buildStubBrief(_district);
    }

    const status = deriveStatus();
    if (status === 'missing_api_key') {
      return buildStubBrief(_district);
    }

    // TODO: Request AirKorea realtime data (e.g., getCtprvnRltmMesureDnsty + station mapping) and populate the brief.
    void http;

    return buildStubBrief(_district);
  }
}

export const airKoreaAdapter = new AirKoreaAdapter();
