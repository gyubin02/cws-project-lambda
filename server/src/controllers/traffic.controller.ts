/**
 * Traffic 컨트롤러: 도시 교통/고속도로/톨게이트 API를 Express와 Lambda에서 재사용.
 * IMPLEMENTATION STATUS: OK (validation + service orchestration; relies on tmapAdapter for geocoding)
 */

import { z } from 'zod';
import { trafficService } from '../services/traffic.service';
import { logger } from '../lib/logger';
import type { Coordinates } from '../types';
import { parseCoordOrGeocode, COORDINATE_REGEX, LOCATION_INPUT_MESSAGE } from '../lib/util';
import { tmapAdapter } from '../adapters/tmap.adapter';
import { UpstreamError } from '../lib/errors';
import { ControllerResult } from './types';

const locationSchema = z.union([
  z.string().regex(COORDINATE_REGEX, { message: LOCATION_INPUT_MESSAGE }),
  z.string().min(1, LOCATION_INPUT_MESSAGE),
]);

const CityQuerySchema = z.object({
  from: locationSchema,
  to: locationSchema,
  time: z.string().datetime().optional(),
  at: z.string().datetime().optional(),
});

const ExpresswayQuerySchema = CityQuerySchema;

const RouteTollgatesQuerySchema = z
  .object({
    fromAddr: z.string().trim().optional(),
    toAddr: z.string().trim().optional(),
    fromLat: z.string().optional(),
    fromLon: z.string().optional(),
    toLat: z.string().optional(),
    toLon: z.string().optional(),
    bufferMeters: z.string().optional(),
    maxTollgates: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const hasAddress = !!value.fromAddr && !!value.toAddr;
    const hasCoords =
      value.fromLat != null &&
      value.fromLon != null &&
      value.toLat != null &&
      value.toLon != null;

    if (!hasAddress && !hasCoords) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide either fromAddr/toAddr or fromLat/fromLon/toLat/toLon',
      });
    }

    if (hasAddress && hasCoords) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Use either address parameters or coordinate parameters, not both.',
      });
    }
  });

function parseOptionalNumber(value?: string) {
  if (value == null || value === '') return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

async function parseCityCoords(query: z.infer<typeof CityQuerySchema>): Promise<{
  from: Coordinates;
  to: Coordinates;
  when?: Date;
}> {
  const { from, to, at, time } = query;
  const whenValue = at ?? time;
  const fromCoords = await parseCoordOrGeocode(from, (q) => tmapAdapter.geocode(q));
  const toCoords = await parseCoordOrGeocode(to, (q) => tmapAdapter.geocode(q));
  const result: { from: Coordinates; to: Coordinates; when?: Date } = {
    from: fromCoords,
    to: toCoords,
  };
  if (whenValue) {
    result.when = new Date(whenValue);
  }
  return result;
}

export async function getCarTrafficController(query: unknown): Promise<ControllerResult> {
  const parsed = CityQuerySchema.safeParse(query);
  if (!parsed.success) {
    return {
      statusCode: 400,
      body: { error: 'bad_request', message: LOCATION_INPUT_MESSAGE, issues: parsed.error.issues },
    };
  }

  let coords: { from: Coordinates; to: Coordinates; when?: Date };
  try {
    coords = await parseCityCoords(parsed.data);
  } catch (error) {
    return {
      statusCode: 400,
      body: { error: 'bad_request', message: (error as Error).message || LOCATION_INPUT_MESSAGE },
    };
  }

  const opts: Parameters<typeof trafficService.getCityTraffic>[2] = { modes: ['car'] };
  if (coords.when) opts.when = coords.when;

  const cityTraffic = await trafficService.getCityTraffic(coords.from, coords.to, opts);

  if (!cityTraffic.car) {
    return { statusCode: 502, body: { error: 'upstream_failure', message: 'Car traffic unavailable' } };
  }

  logger.info({ from: coords.from, to: coords.to, mode: 'car' }, 'Returned car traffic');
  return { statusCode: 200, body: cityTraffic.car };
}

export async function getTransitTrafficController(query: unknown): Promise<ControllerResult> {
  const parsed = CityQuerySchema.safeParse(query);
  if (!parsed.success) {
    return {
      statusCode: 400,
      body: { error: 'bad_request', message: LOCATION_INPUT_MESSAGE, issues: parsed.error.issues },
    };
  }

  let coords: { from: Coordinates; to: Coordinates; when?: Date };
  try {
    coords = await parseCityCoords(parsed.data);
  } catch (error) {
    return {
      statusCode: 400,
      body: { error: 'bad_request', message: (error as Error).message || LOCATION_INPUT_MESSAGE },
    };
  }

  const opts: Parameters<typeof trafficService.getCityTraffic>[2] = { modes: ['transit'] };
  if (coords.when) opts.when = coords.when;

  const cityTraffic = await trafficService.getCityTraffic(coords.from, coords.to, opts);

  if (!cityTraffic.transit) {
    return { statusCode: 502, body: { error: 'upstream_failure', message: 'Transit traffic unavailable' } };
  }

  logger.info({ from: coords.from, to: coords.to, mode: 'transit' }, 'Returned transit traffic');
  return { statusCode: 200, body: cityTraffic.transit };
}

export async function getCityTrafficController(query: unknown): Promise<ControllerResult> {
  const parsed = CityQuerySchema.safeParse(query);
  if (!parsed.success) {
    return {
      statusCode: 400,
      body: { ok: false, error: 'bad_request', message: LOCATION_INPUT_MESSAGE, issues: parsed.error.issues },
    };
  }

  let coords: { from: Coordinates; to: Coordinates; when?: Date };
  try {
    coords = await parseCityCoords(parsed.data);
  } catch (error) {
    return {
      statusCode: 400,
      body: {
        ok: false,
        error: 'bad_request',
        message: (error as Error).message || LOCATION_INPUT_MESSAGE,
      },
    };
  }

  try {
    const opts: { when?: Date } = {};
    if (coords.when) {
      opts.when = coords.when;
    }

    const aggregated = await trafficService.getAggregatedCityTraffic(coords.from, coords.to, opts);

    logger.info(
      { from: coords.from, to: coords.to, route: 'city' },
      'Returned aggregated city traffic'
    );

    return {
      statusCode: 200,
      body: {
        ok: true,
        data: aggregated,
      },
    };
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        from: parsed.data.from,
        to: parsed.data.to,
      },
      'Failed to fetch aggregated city traffic'
    );
    return {
      statusCode: 500,
      body: {
        ok: false,
        error: 'city_fetch_failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

export async function getExpresswayTrafficController(query: unknown): Promise<ControllerResult> {
  const parsed = ExpresswayQuerySchema.safeParse(query);
  if (!parsed.success) {
    return {
      statusCode: 400,
      body: { error: 'bad_request', message: LOCATION_INPUT_MESSAGE, issues: parsed.error.issues },
    };
  }

  let coords: { from: Coordinates; to: Coordinates; when?: Date };
  try {
    coords = await parseCityCoords(parsed.data);
  } catch (error) {
    return {
      statusCode: 400,
      body: { error: 'bad_request', message: (error as Error).message || LOCATION_INPUT_MESSAGE },
    };
  }

  const opts: Parameters<typeof trafficService.getExpresswayTraffic>[2] = {};
  if (coords.when) opts.when = coords.when;

  const expressway = await trafficService.getExpresswayTraffic(coords.from, coords.to, opts);

  logger.info(
    {
      from: coords.from,
      to: coords.to,
      meta: expressway.meta,
    },
    'Returned expressway traffic'
  );
  return { statusCode: 200, body: expressway };
}

export async function getRouteTollgatesController(query: unknown): Promise<ControllerResult> {
  const parsed = RouteTollgatesQuerySchema.safeParse(query);
  if (!parsed.success) {
    return {
      statusCode: 400,
      body: {
        error: 'bad_request',
        message: 'Invalid query parameters',
        issues: parsed.error.issues,
      },
    };
  }

  const data = parsed.data;
  const bufferMeters = parseOptionalNumber(data.bufferMeters);
  if (data.bufferMeters && bufferMeters == null) {
    return { statusCode: 400, body: { error: 'bad_request', message: 'bufferMeters must be a number >= 0' } };
  }

  const maxTollgates = parseOptionalNumber(data.maxTollgates);
  if (data.maxTollgates && (maxTollgates == null || maxTollgates < 0)) {
    return { statusCode: 400, body: { error: 'bad_request', message: 'maxTollgates must be a number >= 0' } };
  }

  try {
    if (data.fromAddr && data.toAddr) {
      const params: any = { fromAddr: data.fromAddr, toAddr: data.toAddr };
      if (bufferMeters != null) params.bufferMeters = bufferMeters;
      if (maxTollgates != null) params.maxTollgates = maxTollgates;
      const result = await trafficService.getRouteTollgates(params);
      return { statusCode: 200, body: result };
    }

    const fromLat = Number(data.fromLat);
    const fromLon = Number(data.fromLon);
    const toLat = Number(data.toLat);
    const toLon = Number(data.toLon);

    if (!Number.isFinite(fromLat) || !Number.isFinite(fromLon) || !Number.isFinite(toLat) || !Number.isFinite(toLon)) {
      return { statusCode: 400, body: { error: 'bad_request', message: 'Coordinates must be valid numbers' } };
    }

    const params: any = {
      from: { lat: fromLat, lon: fromLon },
      to: { lat: toLat, lon: toLon },
    };
    if (bufferMeters != null) params.bufferMeters = bufferMeters;
    if (maxTollgates != null) params.maxTollgates = maxTollgates;

    const result = await trafficService.getRouteTollgates(params);
    return { statusCode: 200, body: result };
  } catch (error) {
    logger.error(
      {
        route: 'route-tollgates',
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to resolve route tollgates'
    );

    const message = error instanceof Error ? error.message : 'Failed to resolve route tollgates';
    const status = error instanceof UpstreamError && typeof error.status === 'number' ? error.status : 502;
    return { statusCode: status, body: { error: 'upstream_failure', message } };
  }
}
