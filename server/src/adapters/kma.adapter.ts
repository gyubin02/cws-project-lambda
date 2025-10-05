import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ENV } from '../lib/env';
import { liveOrMock } from '../lib/liveOrMock';
import { http } from '../lib/http';
import { calculateFeelsLike, mapWeatherCondition, normalizePop } from '../lib/util';
import { latLonToGrid, mergeUltraAndVillage, selectBaseSlots } from '../lib/kma.util';
import type { WeatherBrief, WeatherHourly } from '../types';

const FIXTURE_DIR = path.resolve(__dirname, '../../../fixtures');
const ULTRA_FIXTURE = path.join(FIXTURE_DIR, 'kma_ultra.sample.json');
const VILLAGE_FIXTURE = path.join(FIXTURE_DIR, 'kma_village.sample.json');

type MergeResult = ReturnType<typeof mergeUltraAndVillage>;

const readFixture = async <T>(filePath: string): Promise<T> => {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
};

const buildWeatherBrief = (
  merged: MergeResult,
  status: WeatherBrief['source_status'],
  note?: string
): WeatherBrief => {
  const now = merged.now;
  const temperature = now.temperature;
  const humidity = now.humidity;
  const windSpeed = now.windSpeed;
  const condition = mapWeatherCondition(now.precipType ?? 0, now.sky ?? 1);
  const popNormalized = merged.pop != null ? normalizePop(merged.pop) : undefined;

  let feelsLike: number | undefined;
  if (temperature != null && humidity != null && windSpeed != null) {
    feelsLike = Math.round(calculateFeelsLike(temperature, humidity, windSpeed) * 10) / 10;
  }

  const hourly: WeatherHourly[] = merged.hourly.slice(0, 6).map((entry) => {
    const hourlyCondition = mapWeatherCondition(entry.precipType ?? 0, entry.sky ?? now.sky ?? 1);
    const item: WeatherHourly = {
      time: entry.time,
      temp_c: entry.temperature ?? temperature ?? 0,
      pop: entry.pop != null ? normalizePop(entry.pop) : 0,
      condition: hourlyCondition,
    };
    return item;
  });

  const notes = [...merged.notes];
  if (note) notes.push(note);

  const brief: WeatherBrief = {
    source: 'kma',
    source_status: status,
    updated_at: new Date().toISOString(),
    condition,
  };

  if (temperature != null) {
    brief.temp_c = temperature;
  }
  if (feelsLike != null) {
    brief.feels_like_c = feelsLike;
  }
  if (popNormalized != null) {
    brief.pop = popNormalized;
  }
  if (humidity != null) {
    brief.humidity = humidity;
  }
  if (windSpeed != null) {
    brief.wind_mps = windSpeed;
  }
  if (now.windDegree != null) {
    brief.wind_degree = now.windDegree;
  }
  if (now.precipMm != null) {
    brief.precip_mm = now.precipMm;
  }
  if (merged.minTemp != null) {
    brief.tmin_c = merged.minTemp;
  }
  if (merged.maxTemp != null) {
    brief.tmax_c = merged.maxTemp;
  }
  if (hourly.length) {
    brief.hourly = hourly;
  }
  if (notes.length) {
    brief.notes = notes;
  }

  return brief;
};

export class KMAAdapter {
  async getWeatherData(lat: number, lon: number, when: Date = new Date()): Promise<WeatherBrief> {
    const hasKeys = Boolean(ENV.KMA_API_KEY);
    const { nx, ny } = latLonToGrid(lat, lon);
    const slots = selectBaseSlots(when);

    return liveOrMock({
      adapter: 'KMA',
      hasKeys,
      live: async () => {
        const [ultra, village] = await Promise.all([
          http.get(`${ENV.KMA_BASE_URL}/getUltraSrtNcst`, {
            params: {
              serviceKey: ENV.KMA_API_KEY,
              dataType: 'JSON',
              base_date: slots.ultra_base_date,
              base_time: slots.ultra_base_time,
              nx,
              ny,
            },
          }),
          http.get(`${ENV.KMA_BASE_URL}/getVilageFcst`, {
            params: {
              serviceKey: ENV.KMA_API_KEY,
              dataType: 'JSON',
              base_date: slots.village_base_date,
              base_time: slots.village_base_time,
              nx,
              ny,
            },
          }),
        ]);

        const merged = mergeUltraAndVillage(ultra.data, village.data, { now: when });
        return buildWeatherBrief(merged, 'ok');
      },
      mock: async () => {
        const [ultra, village] = await Promise.all([
          readFixture(ULTRA_FIXTURE),
          readFixture(VILLAGE_FIXTURE),
        ]);
        const merged = mergeUltraAndVillage(ultra, village, { now: when });
        const status = hasKeys ? 'upstream_error' : 'missing_api_key';
        const note = hasKeys
          ? 'KMA live request failed — returning fixture data.'
          : 'KMA API key missing — returning fixture data.';
        return buildWeatherBrief(merged, status, note);
      },
    });
  }
}

export const kmaAdapter = new KMAAdapter();
