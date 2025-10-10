/**
 * 교통 라우트
 */

import express from 'express';
import { z } from 'zod';
import { trafficService } from '../services/traffic.service';
import type { RouteTollgatesResult } from '../services/traffic.service';
import { recommendService } from '../services/recommend.service';
import { logger } from '../lib/logger';
import { ENV } from '../lib/env';
import type { Coordinates, TrafficTollgate } from '../types';
import { parseCoordOrGeocode, COORDINATE_REGEX, LOCATION_INPUT_MESSAGE } from '../lib/util';
import { tmapAdapter } from '../adapters/tmap.adapter';

const router = express.Router();

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

const mapPlazaCongestion = (value?: string | null): TrafficTollgate['congestion'] | undefined => {
  if (!value) return undefined;
  const normalized = value.toUpperCase();
  if (normalized.includes('SMOOTH')) return 'SMOOTH';
  if (normalized.includes('SLOW') || normalized.includes('MODERATE')) return 'MODERATE';
  if (normalized.includes('HEAVY') || normalized.includes('CONGEST')) return 'CONGESTED';
  if (normalized.includes('BLOCK')) return 'BLOCKED';
  return undefined;
};

const toCityTollgate = (gate: RouteTollgatesResult['tollgates'][number]): TrafficTollgate => {
  const tollgate: TrafficTollgate = {
    code: gate.id,
    name: gate.name,
    lat: gate.lat,
    lon: gate.lon,
  };
  const congestion = mapPlazaCongestion(gate.kec?.congestionLevel);
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
};

router.get('/car', async (req: any, res: any) => {
  const parsed = CityQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'bad_request', message: LOCATION_INPUT_MESSAGE, issues: parsed.error.issues });
  }

  const { from, to } = parsed.data;
  const whenValue = parsed.data.at ?? parsed.data.time;
  let fromCoords: Coordinates;
  let toCoords: Coordinates;
  try {
    fromCoords = await parseCoordOrGeocode(from, (query) => tmapAdapter.geocode(query));
    toCoords = await parseCoordOrGeocode(to, (query) => tmapAdapter.geocode(query));
  } catch (error) {
    return res.status(400).json({ error: 'bad_request', message: (error as Error).message || LOCATION_INPUT_MESSAGE });
  }

  const opts: Parameters<typeof trafficService.getCityTraffic>[2] = { modes: ['car'] };
  if (whenValue) {
    opts.when = new Date(whenValue);
  }

  const cityTraffic = await trafficService.getCityTraffic(fromCoords, toCoords, opts);

  if (!cityTraffic.car) {
    return res.status(502).json({ error: 'upstream_failure', message: 'Car traffic unavailable' });
  }

  logger.info({ from: fromCoords, to: toCoords, mode: 'car' }, 'Returned car traffic');
  return res.json(cityTraffic.car);
});

router.get('/transit', async (req: any, res: any) => {
  const parsed = CityQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'bad_request', message: LOCATION_INPUT_MESSAGE, issues: parsed.error.issues });
  }

  const { from, to } = parsed.data;
  const whenValue = parsed.data.at ?? parsed.data.time;
  let fromCoords: Coordinates;
  let toCoords: Coordinates;
  try {
    fromCoords = await parseCoordOrGeocode(from, (query) => tmapAdapter.geocode(query));
    toCoords = await parseCoordOrGeocode(to, (query) => tmapAdapter.geocode(query));
  } catch (error) {
    return res.status(400).json({ error: 'bad_request', message: (error as Error).message || LOCATION_INPUT_MESSAGE });
  }

  const opts: Parameters<typeof trafficService.getCityTraffic>[2] = { modes: ['transit'] };
  if (whenValue) {
    opts.when = new Date(whenValue);
  }

  const cityTraffic = await trafficService.getCityTraffic(fromCoords, toCoords, opts);

  if (!cityTraffic.transit) {
    return res.status(502).json({ error: 'upstream_failure', message: 'Transit traffic unavailable' });
  }

  logger.info({ from: fromCoords, to: toCoords, mode: 'transit' }, 'Returned transit traffic');
  return res.json(cityTraffic.transit);
});

router.get('/city', async (req: any, res: any) => {
  const parsed = CityQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'bad_request', message: LOCATION_INPUT_MESSAGE, issues: parsed.error.issues });
  }

  const { from, to } = parsed.data;
  const whenValue = parsed.data.at ?? parsed.data.time;
  let fromCoords: Coordinates;
  let toCoords: Coordinates;

  try {
    fromCoords = await parseCoordOrGeocode(from, (query) => tmapAdapter.geocode(query));
    toCoords = await parseCoordOrGeocode(to, (query) => tmapAdapter.geocode(query));
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: 'bad_request',
      message: (error as Error).message || LOCATION_INPUT_MESSAGE,
    });
  }

  const opts: Parameters<typeof trafficService.getCityTraffic>[2] = { modes: ['car', 'transit'] };
  if (whenValue) {
    opts.when = new Date(whenValue);
  }

  try {
    const cityTraffic = await trafficService.getCityTraffic(fromCoords, toCoords, opts);
    const carBrief = cityTraffic.car ?? null;
    const transitBrief = cityTraffic.transit ?? null;

    let enrichedCar = carBrief ? { ...carBrief, tollgates: Array.isArray(carBrief.tollgates) ? carBrief.tollgates : [] } : null;

    if (carBrief) {
      let tollgates: TrafficTollgate[] = [];
      if (carBrief.polyline) {
        try {
          const tollgateResult = await trafficService.getRouteTollgates({
            from: fromCoords,
            to: toCoords,
          });
          tollgates = tollgateResult.tollgates.map(toCityTollgate);
        } catch (error) {
          logger.warn(
            {
              error: error instanceof Error ? error.message : String(error),
              from: fromCoords,
              to: toCoords,
            },
            'Failed to attach tollgates to car brief'
          );
        }
      }
      enrichedCar = { ...carBrief, tollgates };
    }

    const recommendation = recommendService.pickMode({
      car: enrichedCar ?? undefined,
      transit: transitBrief ?? undefined,
      tieThresholdMin: ENV.ETA_TIE_THRESHOLD_MIN,
    });

    logger.info(
      { from: fromCoords, to: toCoords, route: 'city' },
      'Returned aggregated city traffic'
    );

    return res.json({
      ok: true,
      data: {
        car: enrichedCar,
        transit: transitBrief,
        recommendation,
      },
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        from: fromCoords,
        to: toCoords,
      },
      'Failed to fetch aggregated city traffic'
    );
    return res.status(500).json({
      ok: false,
      error: 'city_fetch_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/expressway', async (req: any, res: any) => {
  const parsed = ExpresswayQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'bad_request', message: LOCATION_INPUT_MESSAGE, issues: parsed.error.issues });
  }

  const { from, to } = parsed.data;
  const whenValue = parsed.data.at ?? parsed.data.time;
  let fromCoords: Coordinates;
  let toCoords: Coordinates;
  try {
    fromCoords = await parseCoordOrGeocode(from, (query) => tmapAdapter.geocode(query));
    toCoords = await parseCoordOrGeocode(to, (query) => tmapAdapter.geocode(query));
  } catch (error) {
    return res.status(400).json({ error: 'bad_request', message: (error as Error).message || LOCATION_INPUT_MESSAGE });
  }

  const opts: Parameters<typeof trafficService.getExpresswayTraffic>[2] = {};
  if (whenValue) {
    opts.when = new Date(whenValue);
  }

  const expressway = await trafficService.getExpresswayTraffic(fromCoords, toCoords, opts);

  logger.info({
    from: fromCoords,
    to: toCoords,
    meta: expressway.meta,
  }, 'Returned expressway traffic');
  return res.json(expressway);
});

router.get('/route-tollgates', async (req: any, res: any) => {
  const parsed = RouteTollgatesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'bad_request',
      message: 'Invalid query parameters',
      issues: parsed.error.issues,
    });
  }

  const data = parsed.data;
  const parseOptionalNumber = (value?: string) => {
    if (value == null || value === '') return undefined;
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
  };

  const bufferMeters = parseOptionalNumber(data.bufferMeters);
  if (data.bufferMeters && bufferMeters == null) {
    return res.status(400).json({ error: 'bad_request', message: 'bufferMeters must be a number >= 0' });
  }

  const maxTollgates = parseOptionalNumber(data.maxTollgates);
  if (data.maxTollgates && (maxTollgates == null || maxTollgates < 0)) {
    return res.status(400).json({ error: 'bad_request', message: 'maxTollgates must be a number >= 0' });
  }

  try {
    if (data.fromAddr && data.toAddr) {
      const params: any = { fromAddr: data.fromAddr, toAddr: data.toAddr };
      if (bufferMeters != null) params.bufferMeters = bufferMeters;
      if (maxTollgates != null) params.maxTollgates = maxTollgates;
      const result = await trafficService.getRouteTollgates(params);
      return res.json(result);
    }

    const fromLat = Number(data.fromLat);
    const fromLon = Number(data.fromLon);
    const toLat = Number(data.toLat);
    const toLon = Number(data.toLon);

    if (!Number.isFinite(fromLat) || !Number.isFinite(fromLon) || !Number.isFinite(toLat) || !Number.isFinite(toLon)) {
      return res.status(400).json({ error: 'bad_request', message: 'Coordinates must be valid numbers' });
    }

    const params: any = {
      from: { lat: fromLat, lon: fromLon },
      to: { lat: toLat, lon: toLon },
    };
    if (bufferMeters != null) params.bufferMeters = bufferMeters;
    if (maxTollgates != null) params.maxTollgates = maxTollgates;

    const result = await trafficService.getRouteTollgates(params);
    return res.json(result);
  } catch (error) {
    logger.error({
      route: 'route-tollgates',
      error: error instanceof Error ? error.message : String(error),
    }, 'Failed to resolve route tollgates');

    const message = error instanceof Error ? error.message : 'Failed to resolve route tollgates';
    const status = error instanceof UpstreamError && typeof error.status === 'number' ? error.status : 502;
    return res.status(status).json({ error: 'upstream_failure', message });
  }
});

export default router;
