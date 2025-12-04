/**
 * 교통 서비스 (TMAP + Expressway)
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { TmapAdapter } from '../adapters/tmap.adapter';
import type { GeoJsonFeatureCollection } from '../adapters/tmap.adapter';
import { ExpresswayAdapter } from '../adapters/expressway.adapter';
import type { PlazaTraffic } from '../adapters/expressway.adapter';
import { logger } from '../lib/logger';
import { ENV } from '../lib/env';
import { UpstreamError } from '../lib/errors';
import {
  calculateDistance,
  nearestTollgate,
  tollgatesAlongRoute,
  normalizeTollgateDataset,
} from '../lib/util';
import type { MatchedTollgate, Tollgate } from '../lib/util';
import type { Coordinates, TrafficBrief, TrafficMode, TrafficTollgate } from '../types';
import type { SourceStatus } from '../lib/errors';
import { recommendService } from './recommend.service';
import type { CityRecommendation } from './recommend.service';

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

type AddressRouteParams = {
  fromAddr: string;
  toAddr: string;
  bufferMeters?: number;
  maxTollgates?: number;
};

type CoordinateRouteParams = {
  from: Coordinates;
  to: Coordinates;
  bufferMeters?: number;
  maxTollgates?: number;
};

export type RouteTollgatesParams = AddressRouteParams | CoordinateRouteParams;

type EnrichedTollgate = MatchedTollgate & { kec: PlazaTraffic | null };

export type RouteTollgatesResult = {
  ok: boolean;
  route: {
    distanceMeters?: number;
    durationSeconds?: number;
    geometry?: GeoJsonFeatureCollection;
  };
  tollgates: EnrichedTollgate[];
  fallback: {
    used: boolean;
    reason: string | null;
    legacy?: ExpresswayTrafficResult;
  };
};

const TOLLGATE_DATA_PATH = path.resolve(__dirname, '../../data/expressway_tollgates.json');

export type AggregatedCityTraffic = {
  car: (TrafficBrief & { tollgates?: TrafficTollgate[] }) | null;
  transit: TrafficBrief | null;
  recommendation: CityRecommendation;
};

export class TrafficService {
  private readonly tmap: TmapAdapter;
  private readonly expressway: ExpresswayAdapter;
  private tollgateDatasetPromise?: Promise<Tollgate[]>;

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

    const needCar = requested.includes('car');
    const needTransit = requested.includes('transit');

    if (needCar && needTransit) {
      const [car, transit] = await Promise.all([
        this.callTmap('car', from, to, when),
        this.callTmap('transit', from, to, when),
      ]);
      result.car = car;
      result.transit = transit;
    } else {
      if (needCar) {
        result.car = await this.callTmap('car', from, to, when);
      }
      if (needTransit) {
        result.transit = await this.callTmap('transit', from, to, when);
      }
    }

    if (requested.includes('walk')) {
      result.walk = this.estimateActiveMode('walk', from, to, 'tmap');
    }

    if (requested.includes('bike')) {
      result.bike = this.estimateActiveMode('bike', from, to, 'tmap');
    }

    return result;
  }

  async getAggregatedCityTraffic(
    from: Coordinates,
    to: Coordinates,
    opts: { when?: Date } = {}
  ): Promise<AggregatedCityTraffic> {
    const { when } = opts;
    const cityOpts: { when?: Date; modes: TrafficMode[] } = { modes: ['car', 'transit'] };
    if (when) {
      cityOpts.when = when;
    }

    const city = await this.getCityTraffic(from, to, cityOpts);

    let carBrief = city.car ?? null;
    const transitBrief = city.transit ?? null;

    if (carBrief) {
      let tollgates: TrafficTollgate[] = [];
      if (carBrief.polyline) {
        try {
          const tollgateResult = await this.getRouteTollgates({ from, to });
          tollgates = tollgateResult.tollgates.map((gate) => this.toTrafficTollgate(gate));
        } catch (error) {
          logger.warn(
            {
              error: error instanceof Error ? error.message : String(error),
              from,
              to,
            },
            'Failed to attach tollgates to car brief'
          );
        }
      }
      carBrief = { ...carBrief, tollgates };
    }

    const recommendationInput: { car?: TrafficBrief | null; transit?: TrafficBrief | null; tieThresholdMin?: number } =
      { tieThresholdMin: ENV.ETA_TIE_THRESHOLD_MIN };

    if (carBrief != null) recommendationInput.car = carBrief;
    if (transitBrief != null) recommendationInput.transit = transitBrief;

    const recommendation = recommendService.pickMode(recommendationInput);

    return {
      car: carBrief,
      transit: transitBrief ?? null,
      recommendation,
    };
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

  async getRouteTollgates(params: RouteTollgatesParams): Promise<RouteTollgatesResult> {
    const bufferValue = params.bufferMeters ?? 200;
    const maxValue = params.maxTollgates ?? 12;
    const bufferMeters = Number.isFinite(bufferValue) ? Math.max(0, Number(bufferValue)) : 200;
    const maxTollgates = Number.isFinite(maxValue) ? Math.max(0, Math.floor(Number(maxValue))) : 12;

    let from: Coordinates;
    let to: Coordinates;

    if ('fromAddr' in params) {
      from = await this.tmap.geocode(params.fromAddr);
      to = await this.tmap.geocode(params.toAddr);
    } else {
      from = params.from;
      to = params.to;
    }

    const carRoute = await this.tmap.getCarRoute(from, to, { includeGeometry: true });
    const line = this.extractRouteLine(carRoute.geometry, from, to);
    const tollgateDataset = await this.loadTollgates();

    let fallbackReason: string | null = null;
    let matched: MatchedTollgate[] = [];

    if (!tollgateDataset.length) {
      fallbackReason = 'tollgate_dataset_empty';
    } else if (maxTollgates === 0) {
      matched = [];
    } else {
      matched = tollgatesAlongRoute(line, tollgateDataset, bufferMeters, maxTollgates);
      if (!matched.length) {
        fallbackReason = 'no_tollgates_matched';
      }
    }

    const toKec = async (tollgate: MatchedTollgate): Promise<EnrichedTollgate> => {
      const getFallback = (): PlazaTraffic => ({ observedAt: new Date().toISOString(), source: 'kec_unavailable' });
      let plaza = await this.expressway.getPlazaTraffic(tollgate.id);
      if (!plaza) {
        plaza = getFallback();
      }

      return {
        ...tollgate,
        distanceFromRouteMeters: Math.round(tollgate.distanceFromRouteMeters),
        progressRatio: Number(tollgate.progressRatio.toFixed(4)),
        kec: plaza,
      };
    };

    const enriched = await Promise.all(matched.map((item) => toKec(item)));

    const routeSummary: RouteTollgatesResult['route'] = {};
    if (typeof carRoute.distanceMeters === 'number') {
      routeSummary.distanceMeters = carRoute.distanceMeters;
    }
    if (typeof carRoute.durationSeconds === 'number') {
      routeSummary.durationSeconds = carRoute.durationSeconds;
    }
    if (carRoute.geometry) {
      routeSummary.geometry = carRoute.geometry;
    }

    const result: RouteTollgatesResult = {
      ok: true,
      route: routeSummary,
      tollgates: enriched,
      fallback: { used: false, reason: null },
    };

    if (fallbackReason) {
      const legacy = await this.getExpresswayTraffic(from, to);
      result.fallback = {
        used: true,
        reason: fallbackReason,
        legacy,
      };
    }

    return result;
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

  private async loadTollgates(): Promise<Tollgate[]> {
    if (!this.tollgateDatasetPromise) {
      this.tollgateDatasetPromise = (async () => {
        try {
          const file = await fs.readFile(TOLLGATE_DATA_PATH, 'utf8');
          const parsed = JSON.parse(file);
          const dataset = normalizeTollgateDataset(parsed);
          if (!dataset.length) {
            logger.warn({ path: TOLLGATE_DATA_PATH }, 'Tollgate dataset loaded but empty');
          }
          return dataset;
        } catch (error) {
          logger.error(
            {
              error: error instanceof Error ? error.message : String(error),
              path: TOLLGATE_DATA_PATH,
            },
            'Failed to load tollgate dataset'
          );
          return [];
        }
      })();
    }
    return this.tollgateDatasetPromise;
  }

  private mapTollgateCongestion(value?: string | null): TrafficTollgate['congestion'] | undefined {
    if (!value) return undefined;
    const normalized = value.toUpperCase();
    if (normalized.includes('SMOOTH')) return 'SMOOTH';
    if (normalized.includes('SLOW') || normalized.includes('MODERATE')) return 'MODERATE';
    if (normalized.includes('HEAVY') || normalized.includes('CONGEST')) return 'CONGESTED';
    if (normalized.includes('BLOCK')) return 'BLOCKED';
    return undefined;
  }

  private toTrafficTollgate(gate: RouteTollgatesResult['tollgates'][number]): TrafficTollgate {
    const tollgate: TrafficTollgate = {
      code: gate.id,
      name: gate.name,
      lat: gate.lat,
      lon: gate.lon,
    };
    const congestion = this.mapTollgateCongestion(gate.kec?.congestionLevel);
    if (congestion) {
      tollgate.congestion = congestion;
    }
    if (typeof gate.kec?.speedKph === 'number' && Number.isFinite(gate.kec.speedKph)) {
      tollgate.speed_kph = Math.round(gate.kec.speedKph);
    }
    if (gate.kec?.observedAt) {
      tollgate.updated_at = gate.kec.observedAt;
    }
    if (gate.kec?.source) {
      tollgate.source = gate.kec.source;
    }
    return tollgate;
  }

  private extractRouteLine(
    geometry: GeoJsonFeatureCollection | undefined,
    from: Coordinates,
    to: Coordinates
  ): Coordinates[] {
    const defaultLine: Coordinates[] = [from, to];
    if (!geometry) {
      return defaultLine;
    }

    const lineFeature = geometry.features.find(
      (feature) => feature.geometry && (feature.geometry as any).type === 'LineString'
    );

    if (!lineFeature) {
      return defaultLine;
    }

    const coords = (lineFeature.geometry as any)?.coordinates;
    if (!Array.isArray(coords)) {
      return defaultLine;
    }

    const points: Coordinates[] = [];
    for (const pair of coords) {
      if (!Array.isArray(pair) || pair.length < 2) continue;
      const lon = Number(pair[0]);
      const lat = Number(pair[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      points.push({ lat, lon });
    }

    if (points.length < 2) {
      return defaultLine;
    }

    return points;
  }
}

export const trafficService = new TrafficService();
