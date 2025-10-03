/**
 * 교통 서비스 (TMAP + Expressway)
 */

import { TmapAdapter } from '../adapters/tmap.adapter';
import { ExpresswayAdapter } from '../adapters/expressway.adapter';
import { logger } from '../lib/logger';
import { UpstreamError } from '../lib/errors';
import { calculateDistance, nearestTollgate } from '../lib/util';
import type { Coordinates, TrafficBrief, TrafficMode } from '../types';
import type { SourceStatus } from '../lib/errors';

type CityTrafficResult = {
  car?: TrafficBrief;
  transit?: TrafficBrief;
  walk?: TrafficBrief;
  bike?: TrafficBrief;
};

type ExpresswayTrafficResult = {
  expressway?: TrafficBrief;
  meta?: { fromToll: string; toToll: string };
};

export class TrafficService {
  private readonly tmap: TmapAdapter;
  private readonly expressway: ExpresswayAdapter;

  constructor() {
    this.tmap = new TmapAdapter();
    this.expressway = new ExpresswayAdapter();
  }

  async getCityTraffic(
    from: Coordinates,
    to: Coordinates,
    opts: { when?: Date; modes?: TrafficMode[] } = {}
  ): Promise<CityTrafficResult> {
    const { when, modes } = opts;
    const requested = modes ?? ['car', 'transit'];
    const result: CityTrafficResult = {};

    if (requested.includes('car')) {
      result.car = await this.callTmap('car', from, to, when);
    }

    if (requested.includes('transit')) {
      result.transit = await this.callTmap('transit', from, to, when);
    }

    if (requested.includes('walk')) {
      result.walk = this.estimateActiveMode('walk', from, to, 'tmap');
    }

    if (requested.includes('bike')) {
      result.bike = this.estimateActiveMode('bike', from, to, 'tmap');
    }

    return result;
  }

  async getExpresswayTraffic(
    from: Coordinates,
    to: Coordinates,
    opts: { when?: Date } = {}
  ): Promise<ExpresswayTrafficResult> {
    const fromToll = nearestTollgate(from.lat, from.lon);
    const toToll = nearestTollgate(to.lat, to.lon);

    logger.debug({ fromToll, toToll }, 'Resolved tollgates for expressway route');

    try {
      const expresswayBrief = await this.expressway.routeExpresswayByTollgate(fromToll.id, toToll.id, opts.when);
      return {
        expressway: expresswayBrief,
        meta: { fromToll: fromToll.id, toToll: toToll.id },
      };
    } catch (error) {
      const upstream = error instanceof UpstreamError ? error : undefined;
      const status: SourceStatus = upstream?.code ?? 'upstream_error';
      const message = upstream?.message ?? (error instanceof Error ? error.message : 'Unknown error');

      logger.error({ error: message, fromToll: fromToll.id, toToll: toToll.id }, 'Expressway adapter failed');

      return {
        expressway: this.buildFailureBrief('expressway', 'car', status, message),
        meta: { fromToll: fromToll.id, toToll: toToll.id },
      };
    }
  }

  private async callTmap(
    mode: Extract<TrafficMode, 'car' | 'transit'>,
    from: Coordinates,
    to: Coordinates,
    when?: Date
  ): Promise<TrafficBrief> {
    try {
      if (mode === 'car') {
        return await this.tmap.routeCar(from, to, when);
      }
      return await this.tmap.routeTransit(from, to, when);
    } catch (error) {
      const upstream = error instanceof UpstreamError ? error : undefined;
      const status: SourceStatus = upstream?.code ?? 'upstream_error';
      const message = upstream?.message ?? (error instanceof Error ? error.message : 'Unknown error');

      logger.error({ error: message, mode }, 'TMAP adapter failed');

      return this.buildFailureBrief('tmap', mode, status, message);
    }
  }

  private estimateActiveMode(
    mode: Extract<TrafficMode, 'walk' | 'bike'>,
    from: Coordinates,
    to: Coordinates,
    source: TrafficBrief['source']
  ): TrafficBrief {
    const distance = calculateDistance(from, to);
    const speedKmh = mode === 'walk' ? 4.5 : 15; // heuristic speeds
    const etaMinutes = Math.round((distance / speedKmh) * 60);

    return {
      source,
      source_status: 'ok',
      updated_at: new Date().toISOString(),
      mode,
      eta_minutes: etaMinutes,
      distance_km: Math.round(distance * 10) / 10,
      notes: ['Heuristic estimate pending official TMAP support.'],
    } satisfies TrafficBrief;
  }

  private buildFailureBrief(
    source: TrafficBrief['source'],
    mode: TrafficMode,
    status: SourceStatus,
    note: string
  ): TrafficBrief {
    return {
      source,
      source_status: status,
      updated_at: new Date().toISOString(),
      mode,
      notes: [note],
    };
  }
}

export const trafficService = new TrafficService();
