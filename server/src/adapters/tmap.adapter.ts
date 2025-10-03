import { promises as fs } from 'node:fs';
import path from 'node:path';
import { cached } from '../lib/cache';
import { ENV } from '../lib/env';
import { UpstreamError } from '../lib/errors';
import type { Coordinates, TrafficBrief, TrafficMode, TrafficStep } from '../types';

// TODO: Replace fixture usage with TMAP Mobility Open API calls once official docs/links are available.

type TmapCarFixture = {
  routes: Array<{
    summary: {
      duration: number; // seconds
      distance: number; // meters
    };
    sections: Array<{
      type: TrafficStep['type'];
      name?: string;
      duration: number; // seconds
    }>;
    congestion?: 'LOW' | 'MID' | 'HIGH';
  }>;
};

type TmapTransitFixture = {
  paths: Array<{
    summary: {
      duration: number; // seconds
      fare: number; // KRW
      transfers?: number;
    };
    steps: Array<{
      type: TrafficStep['type'];
      name?: string;
      duration: number; // seconds
    }>;
  }>;
};

const CAR_FIXTURE_PATH = path.resolve(__dirname, '../../../fixtures/tmap_car.sample.json');
const TRANSIT_FIXTURE_PATH = path.resolve(__dirname, '../../../fixtures/tmap_transit.sample.json');
const GEOCODE_FIXTURE_PATH = path.resolve(__dirname, '../../../fixtures/tmap_geocode.sample.json');

type TmapGeocodeFixture = {
  results: Array<{
    query: string;
    coordinates: Coordinates;
  }>;
};

function timeBucket5m(when?: Date): string {
  const base = when ? when.getTime() : Date.now();
  const bucket = Math.floor(base / (5 * 60_000));
  return bucket.toString();
}

function buildCacheKey(mode: TrafficMode, from: Coordinates, to: Coordinates, when?: Date): string {
  return `tmap:${mode}:${from.lat.toFixed(5)},${from.lon.toFixed(5)}:${to.lat.toFixed(5)},${to.lon.toFixed(5)}:${timeBucket5m(when)}`;
}

async function loadFixture<T>(filePath: string): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new UpstreamError(`Failed to read fixture ${path.basename(filePath)}`, 'bad_response');
  }
}

function deriveStatus(): { status: TrafficBrief['source_status']; notes: string[] } {
  const status = ENV.TMAP_API_KEY ? 'ok' : 'missing_api_key';
  const notes = status === 'missing_api_key'
    ? ['Using fixture data. Provide TMAP_API_KEY to enable live requests.']
    : ['Using fixture data pending real API integration.'];
  return { status, notes };
}

function summaryToMinutes(seconds: number | undefined): number | undefined {
  if (typeof seconds !== 'number' || Number.isNaN(seconds)) return undefined;
  return Math.round(seconds / 60);
}

function metersToKm(meters: number | undefined): number | undefined {
  if (typeof meters !== 'number' || Number.isNaN(meters)) return undefined;
  return Math.round((meters / 1000) * 10) / 10; // 0.1 km precision
}

export class TmapAdapter {
  async routeCar(from: Coordinates, to: Coordinates, when?: Date): Promise<TrafficBrief> {
    const cacheKey = buildCacheKey('car', from, to, when);
    return cached(cacheKey, async () => {
      const data = await loadFixture<TmapCarFixture>(CAR_FIXTURE_PATH);
      const routes = data.routes;
      if (!routes?.length) {
        throw new UpstreamError('TMAP car fixture missing routes', 'bad_response');
      }
      const primary = routes[0]!;
      const { status, notes } = deriveStatus();
      const steps: TrafficStep[] = (primary.sections ?? []).map((section) => {
        const step: TrafficStep = { type: section.type };
        if (section.name) step.name = section.name;
        const duration = summaryToMinutes(section.duration);
        if (duration != null) step.duration_min = duration;
        return step;
      });

      const brief: TrafficBrief = {
        source: 'tmap',
        source_status: status,
        updated_at: new Date().toISOString(),
        mode: 'car',
        steps,
        notes,
      };

      const eta = summaryToMinutes(primary.summary?.duration);
      if (eta != null) brief.eta_minutes = eta;

      const distance = metersToKm(primary.summary?.distance);
      if (distance != null) brief.distance_km = distance;

      if (primary.congestion) {
        brief.congestion_level = primary.congestion;
      }

      return brief;
    });
  }

  async routeTransit(from: Coordinates, to: Coordinates, when?: Date): Promise<TrafficBrief> {
    const cacheKey = buildCacheKey('transit', from, to, when);
    return cached(cacheKey, async () => {
      const data = await loadFixture<TmapTransitFixture>(TRANSIT_FIXTURE_PATH);
      const paths = data.paths;
      if (!paths?.length) {
        throw new UpstreamError('TMAP transit fixture missing paths', 'bad_response');
      }
      const primary = paths[0]!;
      const { status, notes } = deriveStatus();
      const steps: TrafficStep[] = (primary.steps ?? []).map((step) => {
        const mapped: TrafficStep = { type: step.type };
        if (step.name) mapped.name = step.name;
        const duration = summaryToMinutes(step.duration);
        if (duration != null) mapped.duration_min = duration;
        return mapped;
      });

      const brief: TrafficBrief = {
        source: 'tmap',
        source_status: status,
        updated_at: new Date().toISOString(),
        mode: 'transit',
        steps,
        notes,
      };

      const eta = summaryToMinutes(primary.summary?.duration);
      if (eta != null) brief.eta_minutes = eta;

      if (typeof primary.summary?.fare === 'number') {
        brief.fare_krw = primary.summary.fare;
      }

      if (typeof primary.summary?.transfers === 'number') {
        brief.transfers = primary.summary.transfers;
      }

      return brief;
    });
  }

  async geocode(query: string): Promise<Coordinates> {
    const normalized = query.trim();
    if (!normalized) {
      throw new UpstreamError('Geocode query empty', 'bad_response');
    }

    const cacheKey = `tmap:geocode:${normalized.toLowerCase()}`;
    return cached(cacheKey, async () => {
      const data = await loadFixture<TmapGeocodeFixture>(GEOCODE_FIXTURE_PATH);
      const match = data.results.find((item) => item.query === normalized);
      if (!match) {
        throw new UpstreamError(`No geocode fixture match for "${normalized}"`, 'bad_response');
      }
      return match.coordinates;
    });
  }
}

export const tmapAdapter = new TmapAdapter();
