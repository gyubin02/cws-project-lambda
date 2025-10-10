import { promises as fs } from 'node:fs';
import path from 'node:path';
import { cached } from '../lib/cache';
import { ENV } from '../lib/env';
import { liveOrMock } from '../lib/liveOrMock';
import { http } from '../lib/http';
import { logger } from '../lib/logger';
import { UpstreamError } from '../lib/errors';
import type { Coordinates, TrafficBrief, TrafficMode, TrafficStep } from '../types';

const FIXTURE_DIR = path.resolve(__dirname, '../../../fixtures');
const CAR_FIXTURE_PATH = path.join(FIXTURE_DIR, 'tmap_car.sample.json');
const TRANSIT_FIXTURE_PATH = path.join(FIXTURE_DIR, 'tmap_transit.sample.json');
const GEOCODE_FIXTURE_PATH = path.join(FIXTURE_DIR, 'tmap_geocode.sample.json');
export const GEOCODE_LIVE_FAILURE_PREFIX = 'geocode_failed_live_only:';
const GEOCODE_ERROR_SNIPPET_MAX = 160;
const DEFAULT_TMAP_BASE_URL = 'https://apis.openapi.sk.com/tmap';

const buildTmapUrl = (path: string): string => {
  const base = (ENV.TMAP_BASE_URL || DEFAULT_TMAP_BASE_URL).replace(/\/+$/, '');
  if (!path) {
    return base;
  }
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}`;
};

type CachedMode = Extract<TrafficMode, 'car' | 'transit'>;

type NormalizedSegment = {
  label?: string;
  durationSeconds?: number;
  type?: TrafficStep['type'];
};

type NormalizedRoute = {
  distanceMeters?: number;
  durationSeconds?: number;
  congestion?: string | number;
  fare?: number;
  transfers?: number;
  segments: NormalizedSegment[];
};

type Position = [number, number];

type GeoJsonPoint = {
  type: 'Point';
  coordinates: Position;
};

type GeoJsonLineString = {
  type: 'LineString';
  coordinates: Position[];
};

type GeoJsonFeature = {
  type: 'Feature';
  geometry: GeoJsonPoint | GeoJsonLineString;
  properties?: Record<string, unknown> | null;
};

export type GeoJsonFeatureCollection = {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
};

export interface GetCarRouteOptions {
  includeGeometry?: boolean;
}

type CarRouteFetchResult = {
  raw: any;
  normalized: NormalizedRoute;
  status: TrafficBrief['source_status'];
  note?: string;
  polyline?: GeoJsonLineString;
};

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
};

const secondsToMinutes = (value: unknown): number | undefined => {
  const seconds = toNumber(value);
  if (seconds == null) return undefined;
  return Math.ceil(seconds / 60);
};

const metersToKm = (value: unknown): number | undefined => {
  const meters = toNumber(value);
  if (meters == null) return undefined;
  return Math.round((meters / 1000) * 10) / 10;
};

const ensureSegmentsArray = (segments?: NormalizedSegment[]): NormalizedSegment[] =>
  Array.isArray(segments) ? segments : [];

function timeBucket5m(when?: Date): string {
  const base = when ? when.getTime() : Date.now();
  const bucket = Math.floor(base / (5 * 60_000));
  return bucket.toString();
}

const buildCacheKey = (mode: CachedMode, from: Coordinates, to: Coordinates, when?: Date): string =>
  `tmap:${mode}:${from.lat.toFixed(5)},${from.lon.toFixed(5)}:${to.lat.toFixed(5)},${to.lon.toFixed(5)}:${timeBucket5m(when)}`;

async function readJsonFixture<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

function normalizeCarRoute(data: any): NormalizedRoute {
  const normalized: NormalizedRoute = { segments: [] };

  const features: any[] = Array.isArray(data?.features) ? data.features : [];
  for (const feature of features) {
    const props = feature?.properties ?? {};
    if (props == null) continue;
    const hasTotals = props.totalDistance != null || props.totalTime != null;
    if (hasTotals) {
      const totalDistance = toNumber(props.totalDistance);
      if (totalDistance != null && normalized.distanceMeters == null) {
        normalized.distanceMeters = totalDistance;
      }
      const totalTime = toNumber(props.totalTime);
      if (totalTime != null && normalized.durationSeconds == null) {
        normalized.durationSeconds = totalTime;
      }
      normalized.congestion ??= props.congestion ?? props.trafficState ?? props.trafficType;
      continue;
    }
    const description = props.description ?? props.name ?? props.roadName;
    if (!description) continue;
    const segment: NormalizedSegment = { type: 'drive' };
    segment.label = description;
    const duration = toNumber(props.time ?? props.duration ?? props.totalTime);
    if (duration != null) {
      segment.durationSeconds = duration;
    }
    normalized.segments.push(segment);
  }

  if (!normalized.durationSeconds || !normalized.distanceMeters) {
    const primary = data?.route?.traoptimal?.[0];
    if (primary) {
      const distance = toNumber(primary.summary?.distance);
      if (distance != null && normalized.distanceMeters == null) {
        normalized.distanceMeters = distance;
      }
      const duration = toNumber(primary.summary?.duration);
      if (duration != null && normalized.durationSeconds == null) {
        normalized.durationSeconds = duration;
      }
      normalized.congestion ??= primary.summary?.trafficType;
      if (Array.isArray(primary.guide)) {
        for (const guide of primary.guide) {
          const instruction = guide?.instructions ?? guide?.description;
          if (!instruction) continue;
          const seg: NormalizedSegment = { type: 'drive', label: instruction };
          const duration = toNumber(guide?.duration);
          if (duration != null) {
            seg.durationSeconds = duration;
          }
          normalized.segments.push(seg);
        }
      }
    }
  }

  if (!normalized.durationSeconds || !normalized.distanceMeters) {
    const legacy = data?.routes?.[0];
    if (legacy) {
      const legacyDistance = toNumber(legacy.summary?.distance);
      if (legacyDistance != null && normalized.distanceMeters == null) {
        normalized.distanceMeters = legacyDistance;
      }
      const legacyDuration = toNumber(legacy.summary?.duration);
      if (legacyDuration != null && normalized.durationSeconds == null) {
        normalized.durationSeconds = legacyDuration;
      }
      normalized.congestion ??= legacy.congestion;
      if (Array.isArray(legacy.sections)) {
        for (const section of legacy.sections) {
          const seg: NormalizedSegment = { type: section?.type ?? 'drive' };
          if (section?.name) {
            seg.label = section.name;
          }
          const duration = toNumber(section?.duration);
          if (duration != null) {
            seg.durationSeconds = duration;
          }
          normalized.segments.push(seg);
        }
      }
    }
  }

  return normalized;
}

function toPosition(value: unknown): Position | undefined {
  if (!Array.isArray(value) || value.length < 2) return undefined;
  const lon = toNumber(value[0]);
  const lat = toNumber(value[1]);
  if (lon == null || lat == null) return undefined;
  return [lon, lat];
}

function collectCoordinates(value: unknown, output: Position[]): void {
  if (value == null) return;
  if (Array.isArray(value)) {
    const position = toPosition(value);
    if (position) {
      output.push(position);
      return;
    }
    for (const item of value) collectCoordinates(item, output);
    return;
  }
  if (typeof value === 'object') {
    const coords = (value as any)?.coordinates;
    if (coords) collectCoordinates(coords, output);
  }
}

function dedupeSequentialPositions(positions: Position[]): Position[] {
  const result: Position[] = [];
  let last: Position | undefined;
  for (const position of positions) {
    if (!last || last[0] !== position[0] || last[1] !== position[1]) {
      result.push(position);
      last = position;
    }
  }
  return result;
}

function extractRouteCoordinates(payload: any): Position[] {
  const coordinates: Position[] = [];
  const featureGroups = [
    payload?.features,
    payload?.featureCollection?.features,
    payload?.route?.features,
    payload?.route?.traoptimal?.[0]?.features,
  ];

  for (const group of featureGroups) {
    if (!Array.isArray(group)) continue;
    for (const feature of group) {
      const geometry = feature?.geometry ?? feature;
      if (!geometry) continue;
      const type = typeof geometry.type === 'string' ? geometry.type.toLowerCase() : '';
      if (type === 'linestring' || type === 'multilinestring') {
        collectCoordinates(geometry.coordinates, coordinates);
      }
    }
    if (coordinates.length > 0) {
      return dedupeSequentialPositions(coordinates);
    }
  }

  const pathCandidates = [
    payload?.route?.traoptimal?.[0]?.path,
    payload?.route?.traoptimal?.[0]?.info?.path,
    payload?.route?.traoptimal?.[0]?.geometry?.coordinates,
    payload?.routes?.[0]?.path,
    payload?.path,
  ];

  for (const candidate of pathCandidates) {
    if (!candidate) continue;
    collectCoordinates(candidate, coordinates);
    if (coordinates.length > 0) break;
  }

  return dedupeSequentialPositions(coordinates);
}

function ensureLineCoordinates(
  coordinates: Position[],
  from: Coordinates,
  to: Coordinates
): Position[] {
  if (coordinates.length >= 2) {
    return coordinates;
  }

  const result = coordinates.slice();
  if (result.length === 0) {
    result.push([from.lon, from.lat]);
  }
  result.push([to.lon, to.lat]);
  return result;
}

function buildCarRouteGeometry(raw: any, from: Coordinates, to: Coordinates): GeoJsonFeatureCollection {
  const extracted = extractRouteCoordinates(raw);
  const lineCoords = ensureLineCoordinates(extracted, from, to);

  const features: GeoJsonFeature[] = [];
  if (lineCoords.length >= 2) {
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: lineCoords },
      properties: { role: 'route' },
    });
  }

  features.push({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [from.lon, from.lat] },
    properties: { role: 'origin' },
  });

  features.push({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [to.lon, to.lat] },
    properties: { role: 'destination' },
  });

  return { type: 'FeatureCollection', features };
}

function buildCarRouteLineString(
  raw: any,
  from: Coordinates,
  to: Coordinates
): GeoJsonLineString | undefined {
  const extracted = extractRouteCoordinates(raw);
  const lineCoords = ensureLineCoordinates(extracted, from, to);
  if (lineCoords.length < 2) {
    return undefined;
  }
  return {
    type: 'LineString',
    coordinates: lineCoords,
  };
}

const formatTransitTime = (when?: Date): string | undefined => {
  if (!when) return undefined;
  const year = when.getFullYear();
  const month = String(when.getMonth() + 1).padStart(2, '0');
  const day = String(when.getDate()).padStart(2, '0');
  const hour = String(when.getHours()).padStart(2, '0');
  const minute = String(when.getMinutes()).padStart(2, '0');
  return `${year}${month}${day}${hour}${minute}`;
};

const buildTransitParams = (from: Coordinates, to: Coordinates, when?: Date): Record<string, unknown> => {
  const params: Record<string, unknown> = {
    startX: from.lon,
    startY: from.lat,
    endX: to.lon,
    endY: to.lat,
    reqCoordType: 'WGS84GEO',
    resCoordType: 'WGS84GEO',
    format: 'json',
    lang: 0,
  };
  const departure = formatTransitTime(when);
  if (departure) {
    params['departure_time'] = departure;
  }
  return params;
};

function normalizeTransitRoute(data: any): NormalizedRoute {
  const normalized: NormalizedRoute = { segments: [] };
  const path = data?.paths?.[0];
  if (path) {
    const distance = toNumber(path.summary?.distance);
    if (distance != null && normalized.distanceMeters == null) {
      normalized.distanceMeters = distance;
    }
    const duration = toNumber(path.summary?.duration);
    if (duration != null && normalized.durationSeconds == null) {
      normalized.durationSeconds = duration;
    }
    const fare = toNumber(path.summary?.fare ?? path.summary?.payment);
    if (fare != null && normalized.fare == null) {
      normalized.fare = fare;
    }
    const transfers = toNumber(path.summary?.transfers ?? path.summary?.transferCount);
    if (transfers != null && normalized.transfers == null) {
      normalized.transfers = transfers;
    }

    if (Array.isArray(path.steps)) {
      for (const step of path.steps) {
        const seg: NormalizedSegment = { type: step?.type ?? 'walk' };
        if (step?.name) {
          seg.label = step.name;
        }
        const duration = toNumber(step?.duration);
        if (duration != null) {
          seg.durationSeconds = duration;
        }
        normalized.segments.push(seg);
      }
    }
  }

  return normalized;
}

function parseCongestion(value: string | number | undefined): TrafficBrief['congestion_level'] | undefined {
  if (typeof value === 'string') {
    const upper = value.toUpperCase();
    if (upper.includes('LOW') || upper.includes('FREE')) return 'LOW';
    if (upper.includes('MID') || upper.includes('SLOW')) return 'MID';
    if (upper.includes('HIGH') || upper.includes('CONGEST')) return 'HIGH';
  } else if (typeof value === 'number') {
    if (value <= 1) return 'LOW';
    if (value === 2) return 'MID';
    if (value >= 3) return 'HIGH';
  }
  return undefined;
}

type MapRouteOptions = {
  status: TrafficBrief['source_status'];
  mode: Extract<TrafficMode, 'car' | 'transit'>;
  note?: string;
  polyline?: GeoJsonLineString;
};

function mapNormalizedRoute(route: NormalizedRoute, opts: MapRouteOptions): TrafficBrief {
  const etaMinutes = secondsToMinutes(route.durationSeconds);
  if (etaMinutes == null) {
    throw new UpstreamError('TMAP response missing duration', 'bad_response');
  }

  const distanceKm = metersToKm(route.distanceMeters);
  const steps = ensureSegmentsArray(route.segments).map((segment) => {
    const step: TrafficStep = { type: segment.type ?? (opts.mode === 'car' ? 'drive' : 'walk') };
    if (segment.label) {
      step.name = segment.label;
    }
    const duration = secondsToMinutes(segment.durationSeconds);
    if (duration != null) {
      step.duration_min = duration;
    }
    return step;
  });

  const extraNotes: string[] = [];
  if (opts.note) extraNotes.push(opts.note);

  const brief: TrafficBrief = {
    source: 'tmap',
    source_status: opts.status,
    updated_at: new Date().toISOString(),
    mode: opts.mode,
    eta_minutes: etaMinutes,
  };

  if (opts.polyline) {
    brief.polyline = opts.polyline;
  }

  if (distanceKm != null) {
    brief.distance_km = distanceKm;
  }
  if (steps.length) {
    brief.steps = steps;
  }

  const congestion = parseCongestion(route.congestion);
  if (congestion) {
    brief.congestion_level = congestion;
  }

  if (opts.mode === 'transit') {
    if (route.fare != null) {
      brief.fare_krw = Math.round(route.fare);
    }
    if (route.transfers != null) {
      brief.transfers = Math.round(route.transfers);
    }
  }

  if (extraNotes.length) {
    brief.notes = extraNotes;
  }

  return brief;
}

type GeocodePayload = {
  coordinateInfo?: {
    coordinate?: Array<Record<string, unknown>>;
  };
  results?: Array<{ query?: string; coordinates?: Coordinates }>;
};

function mapTmapGeocode(payload: GeocodePayload, query: string): Coordinates {
  const coordinateInfo = payload?.coordinateInfo?.coordinate;
  if (Array.isArray(coordinateInfo) && coordinateInfo.length > 0) {
    const primary = coordinateInfo[0] as Record<string, unknown>;
    const lat =
      toNumber(primary?.['lat']) ??
      toNumber(primary?.['newLat']) ??
      toNumber(primary?.['latEntr']) ??
      toNumber(primary?.['newLatEntr']) ??
      toNumber(primary?.['noorLat']) ??
      toNumber(primary?.['frontLat']);

    const lon =
      toNumber(primary?.['lon']) ??
      toNumber(primary?.['newLon']) ??
      toNumber(primary?.['lonEntr']) ??
      toNumber(primary?.['newLonEntr']) ??
      toNumber(primary?.['noorLon']) ??
      toNumber(primary?.['frontLon']);

    if (lat != null && lon != null) {
      return { lat, lon };
    }
  }

  if (Array.isArray(payload?.results) && payload.results.length > 0) {
    const normalized = query.trim();
    const match = payload.results.find((item) => item.query === normalized);
    if (!match) {
      throw new UpstreamError(`TMAP geocode result missing entry for "${normalized}"`, 'bad_response');
    }
    const coordinates = match.coordinates;
    if (coordinates?.lat != null && coordinates.lon != null) {
      return coordinates;
    }
  }

  throw new UpstreamError('TMAP geocode response missing coordinates', 'bad_response');
}

type GeocodeErrorDetails = {
  status?: number;
  snippet?: string;
};

function cleanSnippet(value: unknown): string | undefined {
  if (value == null) return undefined;

  let text: string;
  if (typeof value === 'string') {
    text = value;
  } else if (typeof value === 'object') {
    try {
      text = JSON.stringify(value);
    } catch (_error) {
      text = String(value);
    }
  } else {
    text = String(value);
  }

  text = text.replace(/\s+/g, ' ').trim();
  if (!text) return undefined;
  if (text.length > GEOCODE_ERROR_SNIPPET_MAX) {
    return text.slice(0, GEOCODE_ERROR_SNIPPET_MAX);
  }
  return text;
}

function summarizeGeocodeError(error: unknown): GeocodeErrorDetails {
  if (error instanceof UpstreamError) {
    const details: GeocodeErrorDetails = {};
    if (typeof error.status === 'number') {
      details.status = error.status;
    }
    const snippet = cleanSnippet(error.message);
    if (snippet) {
      details.snippet = snippet;
    }
    return details;
  }

  const maybeResponse = (error as any)?.response;
  const details: GeocodeErrorDetails = {};
  const status = typeof maybeResponse?.status === 'number' ? (maybeResponse.status as number) : undefined;
  if (status != null) {
    details.status = status;
  }
  const responseSnippet = cleanSnippet(maybeResponse?.data);
  const errorMessage = error instanceof Error ? cleanSnippet(error.message) : undefined;
  const snippet = responseSnippet ?? errorMessage;
  if (snippet) {
    details.snippet = snippet;
  }

  return details;
}

function createLiveGeocodeError(query: string, details: GeocodeErrorDetails): UpstreamError {
  const parts: string[] = [`"${query}"`];
  if (details.status != null) {
    parts.push(`status ${details.status}`);
  }
  if (details.snippet) {
    parts.push(details.snippet);
  } else {
    parts.push('no additional details');
  }

  const message = `${GEOCODE_LIVE_FAILURE_PREFIX} ${parts.join(' | ')}`;
  const statusCode = details.status != null && details.status >= 500 ? details.status : 503;
  const failure = new UpstreamError(message, 'upstream_error', statusCode);
  return failure;
}

async function performLiveGeocode(normalizedQuery: string): Promise<Coordinates> {
  const apiKey = ENV.TMAP_API_KEY;
  if (!apiKey) {
    logger.warn({ adapter: 'tmap', op: 'geocode' }, 'TMAP API key missing during live geocode');
    throw new UpstreamError('TMAP API key missing during live geocode', 'missing_api_key', 503);
  }

  try {
    const response = await http.get(buildTmapUrl('/geo/fullAddrGeo'), {
      headers: { Accept: 'application/json', appKey: apiKey },
      params: {
        appKey: apiKey,
        fullAddr: normalizedQuery,
        coordType: 'WGS84GEO',
        version: 1,
        addressFlag: 'F02',
        page: 1,
        count: 1,
      },
    });

    try {
      const c0 = response?.data?.coordinateInfo?.coordinate?.[0];
      logger.info({ op: 'tmap_geocode_debug', sample: c0 }, 'TMAP geocode first candidate');
    } catch {}
    return mapTmapGeocode(response.data, normalizedQuery);
  
  } catch (error) {
    const details = summarizeGeocodeError(error);

    logger.warn(
      {
        adapter: 'tmap',
        op: 'geocode',
        query: normalizedQuery,
        status: details.status,
        response: details.snippet,
      },
      'TMAP live geocode request failed'
    );

    const failure = createLiveGeocodeError(normalizedQuery, details);
    if (error instanceof Error) {
      (failure as any).cause = error;
    }
    throw failure;
  }
}

export class TmapAdapter {
  private async fetchCarRouteData(
    from: Coordinates,
    to: Coordinates,
    when?: Date
  ): Promise<CarRouteFetchResult> {
    const cacheKey = buildCacheKey('car', from, to, when);
    const mode = liveOrMock('tmap');

    return cached(cacheKey, async () => {
      const loadFixture = async (
        status: TrafficBrief['source_status'],
        note: string
      ): Promise<CarRouteFetchResult> => {
        const raw = await readJsonFixture(CAR_FIXTURE_PATH);
        const normalized = normalizeCarRoute(raw);
        const polyline = buildCarRouteLineString(raw, from, to);
        return { raw, normalized, status, note, polyline };
      };

      if (mode === 'live') {
        const apiKey = ENV.TMAP_API_KEY;
        if (!apiKey) {
          logger.warn({ adapter: 'tmap' }, 'TMAP API key missing during live mode — falling back to fixture.');
          return loadFixture('missing_api_key', 'TMAP API key missing — returning fixture data.');
        }

        try {
          const response = await http.post(
            buildTmapUrl(ENV.TMAP_CAR_PATH || '/routes'),
            {
              startX: from.lon,
              startY: from.lat,
              endX: to.lon,
              endY: to.lat,
              reqCoordType: 'WGS84GEO',
              resCoordType: 'WGS84GEO',
            },
            {
              headers: { appKey: apiKey, Accept: 'application/json' },
              params: { version: 1 },
            }
          );

          const raw = response.data;
          const normalized = normalizeCarRoute(raw);
          const polyline = buildCarRouteLineString(raw, from, to);
          return { raw, normalized, status: 'ok', polyline };
        } catch (error) {
          logger.warn(
            {
              adapter: 'tmap',
              error: error instanceof Error ? error.message : String(error),
            },
            'TMAP live request failed — falling back to fixture.'
          );
          return loadFixture('degraded', 'TMAP live request failed — returning fixture data.');
        }
      }

      if (ENV.MOCK === 1) {
        return loadFixture('mock', 'MOCK=1 flag set — returning fixture data.');
      }

      return loadFixture('missing_api_key', 'TMAP API key missing — returning fixture data.');
    });
  }

  async routeCar(from: Coordinates, to: Coordinates, when?: Date): Promise<TrafficBrief> {
    const result = await this.fetchCarRouteData(from, to, when);
    const options: MapRouteOptions = { status: result.status, mode: 'car' };
    if (result.note) {
      options.note = result.note;
    }
    if (result.polyline) {
      options.polyline = result.polyline;
    }
    return mapNormalizedRoute(result.normalized, options);
  }

  async getCarRoute(
    from: Coordinates,
    to: Coordinates,
    options: GetCarRouteOptions = {}
  ): Promise<NormalizedRoute & { geometry?: GeoJsonFeatureCollection }> {
    const result = await this.fetchCarRouteData(from, to);
    const route: NormalizedRoute & { geometry?: GeoJsonFeatureCollection } = {
      ...result.normalized,
      segments: result.normalized.segments.slice(),
    };

    if (options.includeGeometry) {
      route.geometry = buildCarRouteGeometry(result.raw, from, to);
    }

    return route;
  }

  async routeTransit(from: Coordinates, to: Coordinates, when?: Date): Promise<TrafficBrief> {
    const cacheKey = buildCacheKey('transit', from, to, when);
    const mode = liveOrMock('tmap');

    return cached(cacheKey, async () => {
      const loadFixture = async (
        status: TrafficBrief['source_status'],
        note: string
      ): Promise<TrafficBrief> => {
        const data = await readJsonFixture(TRANSIT_FIXTURE_PATH);
        const normalized = normalizeTransitRoute(data);
        return mapNormalizedRoute(normalized, { status, mode: 'transit', note });
      };

      if (mode === 'live') {
        const apiKey = ENV.TMAP_API_KEY;
        if (!apiKey) {
          logger.warn({ adapter: 'tmap', op: 'transit' }, 'TMAP API key missing during live transit request — falling back to fixture.');
          return loadFixture('missing_api_key', 'TMAP API key missing — returning fixture transit data.');
        }

        try {
          const response = await http.get(buildTmapUrl(ENV.TMAP_TRANSIT_PATH || '/routes/transit'), {
            headers: { appKey: apiKey, Accept: 'application/json' },
            params: buildTransitParams(from, to, when),
          });

          const normalized = normalizeTransitRoute(response.data);
          return mapNormalizedRoute(normalized, { status: 'ok', mode: 'transit' });
        } catch (error) {
          logger.warn(
            {
              adapter: 'tmap',
              op: 'transit',
              error: error instanceof Error ? error.message : String(error),
            },
            'TMAP transit live request failed — falling back to fixture data.'
          );
          return loadFixture('degraded', 'TMAP transit live request failed — returning fixture transit data.');
        }
      }

      if (ENV.MOCK === 1) {
        return loadFixture('mock', 'MOCK=1 flag set — returning fixture transit data.');
      }

      return loadFixture('missing_api_key', 'TMAP API key missing — returning fixture transit data.');
    });
  }

  async geocode(query: string): Promise<Coordinates> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      throw new UpstreamError('Geocode query empty', 'bad_response');
    }

    const cacheKey = `tmap:geocode:${normalizedQuery.toLowerCase()}`;
    const mode = liveOrMock('tmap');

    const useMock = process.env['MOCK'] === '1' || ENV.MOCK === 1;
    const failOpen = process.env['FAIL_OPEN'] === '1';
    const strict = process.env['GEOCODE_STRICT'] === '1';
    const fallbackAllowed = !strict && (useMock || failOpen);

    return cached(cacheKey, async () => {
      const loadMock = async (): Promise<Coordinates> => {
        const data = await readJsonFixture<GeocodePayload>(GEOCODE_FIXTURE_PATH);
        return mapTmapGeocode(data, normalizedQuery);
      };

      if (mode !== 'live' && useMock && !strict) {
        return loadMock();
      }

      try {
        return await performLiveGeocode(normalizedQuery);
      } catch (error) {
        if (!(error instanceof UpstreamError)) {
          throw error;
        }

        if (!fallbackAllowed) {
          throw error;
        }

        const context = {
          adapter: 'tmap',
          op: 'geocode',
          query: normalizedQuery,
        } as const;

        if (failOpen) {
          logger.info(context, 'Fail-open mode enabled — returning fixture geocode data.');
        } else {
          logger.info(context, 'MOCK=1 flag active — returning fixture geocode data.');
        }

        return loadMock();
      }
    });
  }

  async geocodeLiveOnly(query: string): Promise<Coordinates> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      throw new UpstreamError('Geocode query empty', 'bad_response');
    }

    return performLiveGeocode(normalizedQuery);
  }
}

export const tmapAdapter = new TmapAdapter();
