/**
 * 날씨 서비스 (KMA)
 */

import { KMAAdapter } from '../adapters/kma.adapter';
import { logger } from '../lib/logger';
import { UpstreamError } from '../lib/errors';
import type { Coordinates, WeatherBrief } from '../types';
import type { SourceStatus } from '../lib/errors';

export class WeatherService {
  private readonly adapter: KMAAdapter;

  constructor() {
    this.adapter = new KMAAdapter();
  }

  async getWeatherBrief(coordinates: Coordinates, when?: Date): Promise<WeatherBrief> {
    try {
      logger.debug({ coordinates, when: when?.toISOString() }, 'Fetching weather brief');
      return await this.adapter.getWeatherData(coordinates.lat, coordinates.lon, when);
    } catch (error) {
      const upstream = error instanceof UpstreamError ? error : undefined;
      const status: SourceStatus = upstream?.code ?? 'upstream_error';
      const message = upstream?.message ?? (error instanceof Error ? error.message : 'Unknown error');

      logger.error({ error: message, coordinates }, 'Weather adapter failed');

      return this.buildFailureBrief(status, message);
    }
  }

  private buildFailureBrief(status: SourceStatus, note: string): WeatherBrief {
    return {
      source: 'kma',
      source_status: status,
      updated_at: new Date().toISOString(),
      notes: [note],
    };
  }
}

export const weatherService = new WeatherService();
