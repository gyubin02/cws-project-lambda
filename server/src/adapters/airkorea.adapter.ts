import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ENV } from '../lib/env';
import { liveOrMock } from '../lib/liveOrMock';
import { http } from '../lib/http';
import { logger } from '../lib/logger';
import { calculateAirGrade, getAirQualityAdvice } from '../lib/util';
import { normalizeAirPayload, pickNearestStation, wgs84ToTM } from '../lib/airkorea.util';
import type { AirBrief } from '../types';

const FIXTURE_PATH = path.resolve(__dirname, '../../../fixtures/airkorea_realtime.sample.json');
const AIRKOREA_BASE_URL = (process.env['AIRKOREA_BASE_URL'] ?? '').trim() ||
  'http://apis.data.go.kr/B552584/ArpltnInforInqireSvc';

const readFixture = async <T>(filePath: string): Promise<T> => {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
};

const mapToBrief = (
  normalized: ReturnType<typeof normalizeAirPayload>,
  status: AirBrief['source_status'],
  district?: string,
  note?: string
): AirBrief => {
  const pm10 = normalized.pm10;
  const pm25 = normalized.pm25;
  const grade = calculateAirGrade(pm10 ?? 0, pm25 ?? 0);
  const notes = [...normalized.notes];
  if (note) notes.push(note);

  const brief: AirBrief = {
    source: 'airkorea',
    source_status: status,
    updated_at: normalized.observedAt ?? new Date().toISOString(),
    grade,
    advice: getAirQualityAdvice(grade),
  };

  if (pm10 != null) {
    brief.pm10 = pm10;
  }
  if (pm25 != null) {
    brief.pm25 = pm25;
  }
  if (normalized.stationName) {
    brief.station_name = normalized.stationName;
  }
  if (district) {
    brief.district = district;
  }
  if (normalized.pm10Category) {
    brief.pm10_category = normalized.pm10Category;
  }
  if (normalized.pm25Category) {
    brief.pm25_category = normalized.pm25Category;
  }
  if (normalized.aqi != null) {
    brief.aqi = normalized.aqi;
  }
  if (normalized.aqiCategory) {
    brief.aqi_category = normalized.aqiCategory;
  }
  if (notes.length) {
    brief.notes = notes;
  }

  return brief;
};

export class AirKoreaAdapter {
  async getAirQualityData(district: string | undefined, lat: number, lon: number): Promise<AirBrief> {
    const mode = liveOrMock('airkorea');
    const apiKey = ENV.AIRKOREA_SERVICE_KEY;

    const loadMock = async (
      status: AirBrief['source_status'],
      note: string
    ): Promise<AirBrief> => {
      const payload = await readFixture(FIXTURE_PATH);
      const normalized = normalizeAirPayload(payload);
      return mapToBrief(normalized, status, district, note);
    };

    if (mode === 'live') {
      if (!apiKey) {
        logger.warn({ adapter: 'airkorea' }, 'AirKorea service key missing during live mode — returning fixture data.');
        return loadMock('missing_api_key', 'AirKorea service key missing — returning fixture data.');
      }

      try {
        const { tmX, tmY } = wgs84ToTM(lat, lon);
        const nearby = await http.get(`${AIRKOREA_BASE_URL}/getNearbyMsrstnList`, {
          params: {
            serviceKey: apiKey,
            tmX,
            tmY,
            returnType: 'json',
          },
        });

        const stationName = pickNearestStation(nearby.data);
        const realtime = await http.get(`${AIRKOREA_BASE_URL}/getMsrstnAcctoRltmMesureDnsty`, {
          params: {
            serviceKey: apiKey,
            stationName,
            dataTerm: 'DAILY',
            numOfRows: 1,
            returnType: 'json',
          },
        });

        const normalized = normalizeAirPayload(realtime.data);
        return mapToBrief(normalized, 'ok', district);
      } catch (error) {
        logger.warn(
          {
            adapter: 'airkorea',
            error: error instanceof Error ? error.message : String(error),
          },
          'AirKorea live request failed — falling back to fixture data.'
        );
        return loadMock('upstream_error', 'AirKorea live request failed — returning fixture data.');
      }
    }

    const forcedMock = ENV.MOCK === 1 && !!apiKey;
    const status: AirBrief['source_status'] = forcedMock ? 'upstream_error' : 'missing_api_key';
    const note = forcedMock
      ? 'MOCK=1 flag set — returning fixture air quality data.'
      : 'AirKorea service key missing — returning fixture data.';
    return loadMock(status, note);
  }
}

export const airKoreaAdapter = new AirKoreaAdapter();
