import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ENV } from '../lib/env';
import { liveOrMock } from '../lib/liveOrMock';
import { http } from '../lib/http';
import { calculateAirGrade, getAirQualityAdvice } from '../lib/util';
import { normalizeAirPayload, pickNearestStation, wgs84ToTM } from '../lib/airkorea.util';
import type { AirBrief } from '../types';

const FIXTURE_PATH = path.resolve(__dirname, '../../../fixtures/airkorea_realtime.sample.json');

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
    const hasKeys = Boolean(ENV.AIRKOREA_API_KEY);

    return liveOrMock({
      adapter: 'AIRKOREA',
      hasKeys,
      live: async () => {
        const { tmX, tmY } = wgs84ToTM(lat, lon);
        const nearby = await http.get(`${ENV.AIRKOREA_BASE_URL}/getNearbyMsrstnList`, {
          params: {
            serviceKey: ENV.AIRKOREA_API_KEY,
            tmX,
            tmY,
            returnType: 'json',
          },
        });

        const stationName = pickNearestStation(nearby.data);
        const realtime = await http.get(`${ENV.AIRKOREA_BASE_URL}/getMsrstnAcctoRltmMesureDnsty`, {
          params: {
            serviceKey: ENV.AIRKOREA_API_KEY,
            stationName,
            dataTerm: 'DAILY',
            numOfRows: 1,
            returnType: 'json',
          },
        });

        const normalized = normalizeAirPayload(realtime.data);
        return mapToBrief(normalized, 'ok', district);
      },
      mock: async () => {
        const payload = await readFixture(FIXTURE_PATH);
        const normalized = normalizeAirPayload(payload);
        const status = hasKeys ? 'upstream_error' : 'missing_api_key';
        const note = hasKeys
          ? 'AirKorea live request failed — returning fixture data.'
          : 'AirKorea API key missing — returning fixture data.';
        return mapToBrief(normalized, status, district, note);
      },
    });
  }
}

export const airKoreaAdapter = new AirKoreaAdapter();
