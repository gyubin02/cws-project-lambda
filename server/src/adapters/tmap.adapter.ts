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
const TMAP_BASE_URL = (process.env['TMAP_BASE_URL'] ?? '').trim() || 'https://apis.openapi.sk.com/tmap';
export const GEOCODE_LIVE_FAILURE_PREFIX = 'geocode_failed_live_only:';
const GEOCODE_ERROR_SNIPPET_MAX = 160;

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
    const response = await http.get(`${TMAP_BASE_URL}/geo/fullAddrGeo`, {
      headers: { Accept: 'application/json'},
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
  async routeCar(from: Coordinates, to: Coordinates, when?: Date): Promise<TrafficBrief> {
    const cacheKey = buildCacheKey('car', from, to, when);
    const mode = liveOrMock('tmap');

    return cached(cacheKey, async () => {
      const fixture = async (
        status: TrafficBrief['source_status'],
        note: string
      ): Promise<TrafficBrief> => {
        const data = await readJsonFixture(CAR_FIXTURE_PATH);
        const normalized = normalizeCarRoute(data);
        return mapNormalizedRoute(normalized, { status, mode: 'car', note });
      };

      if (mode === 'live') {
        const apiKey = ENV.TMAP_API_KEY;
        if (!apiKey) {
          logger.warn({ adapter: 'tmap' }, 'TMAP API key missing during live mode — falling back to fixture.');
          return fixture('missing_api_key', 'TMAP API key missing — returning fixture data.');
        }
        try {
          const response = await http.post(
            `${TMAP_BASE_URL}/routes?version=1`,
            {
              startX: from.lon,
              startY: from.lat,
              endX: to.lon,
              endY: to.lat,
              reqCoordType: 'WGS84GEO',
              resCoordType: 'WGS84GEO',
            },
            {
              params: { appKey: apiKey, version: 1 },
            }
          );

          const normalized = normalizeCarRoute(response.data);
          return mapNormalizedRoute(normalized, { status: 'ok', mode: 'car' });
        } catch (error) {
          logger.warn(
            {
              adapter: 'tmap',
              error: error instanceof Error ? error.message : String(error),
            },
            'TMAP live request failed — falling back to fixture.'
          );
          return fixture('upstream_error', 'TMAP live request failed — returning fixture data.');
        }
      }

      const forcedMock = ENV.MOCK === 1 && !!ENV.TMAP_API_KEY;
      const status: TrafficBrief['source_status'] = forcedMock ? 'upstream_error' : 'missing_api_key';
      const note = forcedMock
        ? 'MOCK=1 flag set — returning fixture data.'
        : 'TMAP API key missing — returning fixture data.';
      return fixture(status, note);
    });
  }

  async routeTransit(from: Coordinates, to: Coordinates, when?: Date): Promise<TrafficBrief> {
    const cacheKey = buildCacheKey('transit', from, to, when);
    const mode = liveOrMock('tmap');

    return cached(cacheKey, async () => {
      const data = await readJsonFixture(TRANSIT_FIXTURE_PATH);
      const normalized = normalizeTransitRoute(data);

      let status: TrafficBrief['source_status'];
      let note: string;

      if (mode === 'live') {
        status = 'upstream_error';
        note = 'TMAP transit live endpoint pending — returning fixture data.';
      } else if (!ENV.TMAP_API_KEY) {
        status = 'missing_api_key';
        note = 'TMAP API key missing — returning fixture data.';
      } else if (ENV.MOCK === 1) {
        status = 'upstream_error';
        note = 'MOCK=1 flag set — returning fixture transit data.';
      } else {
        status = 'upstream_error';
        note = 'TMAP transit live endpoint pending — returning fixture data.';
      }

      return mapNormalizedRoute(normalized, {
        status,
        mode: 'transit',
        note,
      });
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
