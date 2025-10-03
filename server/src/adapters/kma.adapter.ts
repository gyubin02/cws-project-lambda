import { http } from '../lib/http';
import { ENV, isMock } from '../lib/env';
import { calculateFeelsLike, latLonToGrid, mapWeatherCondition, normalizePop } from '../lib/util';
import type { WeatherBrief, WeatherHourly } from '../types';

// TODO: Replace stub parsing with KMA Short-Term Forecast 2.0 integration (add official doc citation + URL once available).

type StubObservation = {
  temp_c: number;
  humidity: number;
  wind_mps: number;
  sky: number;
  pty: number;
  pop: number;
  tmin_c: number;
  tmax_c: number;
};

const DEFAULT_OBSERVATION: StubObservation = {
  temp_c: 22,
  humidity: 60,
  wind_mps: 1.8,
  sky: 1,
  pty: 0,
  pop: 30,
  tmin_c: 18,
  tmax_c: 27,
};

function toHourlySeries(base: Date, pop: number, condition: string): WeatherHourly[] {
  const series = Array.from({ length: 6 }).map((_, idx) => {
    const ts = new Date(base.getTime() + idx * 60 * 60 * 1000);
    return {
      time: ts.toISOString(),
      temp_c: DEFAULT_OBSERVATION.temp_c + idx * 0.5,
      pop,
      condition,
    };
  });
  return series;
}

function deriveStatus(): WeatherBrief['source_status'] {
  return ENV.KMA_SERVICE_KEY ? 'ok' : 'missing_api_key';
}

export class KMAAdapter {
  async getWeatherData(lat: number, lon: number, when?: Date): Promise<WeatherBrief> {
    const status = deriveStatus();
    const grid = latLonToGrid(lat, lon);
    const observation = { ...DEFAULT_OBSERVATION };
    const condition = mapWeatherCondition(observation.pty, observation.sky);
    const pop = normalizePop(observation.pop);

    const result: WeatherBrief = {
      source: 'kma',
      source_status: status,
      updated_at: new Date().toISOString(),
      temp_c: observation.temp_c,
      feels_like_c: Math.round(calculateFeelsLike(observation.temp_c, observation.humidity, observation.wind_mps) * 10) / 10,
      condition,
      pop,
      tmin_c: observation.tmin_c,
      tmax_c: observation.tmax_c,
      notes: [
        `Grid (${grid.nx},${grid.ny}) derived from coordinates.`,
        status === 'missing_api_key'
          ? 'Using stub weather data until KMA service key is configured.'
          : 'Stub data active. Replace with live KMA response parsing.',
      ],
    };

    const hourly = toHourlySeries(when ?? new Date(), pop, condition);
    if (hourly.length) {
      result.hourly = hourly;
    }

    if (!isMock && status === 'ok') {
      // TODO: Perform live requests to getUltraSrtNcst/getVilageFcst endpoints and populate fields above.
      void http; // keep eslint/ts from flagging until live integration.
    }

    return result;
  }
}

export const kmaAdapter = new KMAAdapter();
