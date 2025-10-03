/**
 * 대기질 서비스 (AirKorea)
 */

import { AirKoreaAdapter } from '../adapters/airkorea.adapter';
import { logger } from '../lib/logger';
import { UpstreamError } from '../lib/errors';
import type { Coordinates, AirBrief } from '../types';
import type { SourceStatus } from '../lib/errors';

export class AirService {
  private readonly adapter: AirKoreaAdapter;

  constructor() {
    this.adapter = new AirKoreaAdapter();
  }

  async getAirBrief(coordinates: Coordinates, district?: string): Promise<AirBrief> {
    try {
      logger.debug({ coordinates, district }, 'Fetching air quality brief');
      return await this.adapter.getAirQualityData(district, coordinates.lat, coordinates.lon);
    } catch (error) {
      const upstream = error instanceof UpstreamError ? error : undefined;
      const status: SourceStatus = upstream?.code ?? 'upstream_error';
      const message = upstream?.message ?? (error instanceof Error ? error.message : 'Unknown error');

      logger.error({ error: message, coordinates, district }, 'AirKorea adapter failed');

      return this.buildFailureBrief(status, message, district);
    }
  }

  private buildFailureBrief(status: SourceStatus, note: string, district?: string): AirBrief {
    const brief: AirBrief = {
      source: 'airkorea',
      source_status: status,
      updated_at: new Date().toISOString(),
      notes: [note],
    };
    if (district) {
      brief.district = district;
    }
    return brief;
  }
}

export const airService = new AirService();
