/**
 * 교통 라우트
 */

import { Router } from 'express';
import { z } from 'zod';
import { trafficService } from '../services/traffic.service';
import { logger } from '../lib/logger';
import type { Coordinates } from '../types';
import { parseCoordOrGeocode, COORDINATE_REGEX, LOCATION_INPUT_MESSAGE } from '../lib/util';
import { tmapAdapter } from '../adapters/tmap.adapter';

const router: Router = Router();

const locationSchema = z.union([
  z.string().regex(COORDINATE_REGEX, { message: LOCATION_INPUT_MESSAGE }),
  z.string().min(1, LOCATION_INPUT_MESSAGE),
]);

const CityQuerySchema = z.object({
  from: locationSchema,
  to: locationSchema,
  time: z.string().datetime().optional(),
});

const ExpresswayQuerySchema = CityQuerySchema;

router.get('/car', async (req, res) => {
  const parsed = CityQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'bad_request', message: LOCATION_INPUT_MESSAGE, issues: parsed.error.issues });
  }

  const { from, to, time } = parsed.data;
  let fromCoords: Coordinates;
  let toCoords: Coordinates;
  try {
    fromCoords = await parseCoordOrGeocode(from, (query) => tmapAdapter.geocode(query));
    toCoords = await parseCoordOrGeocode(to, (query) => tmapAdapter.geocode(query));
  } catch (error) {
    return res.status(400).json({ error: 'bad_request', message: (error as Error).message || LOCATION_INPUT_MESSAGE });
  }

  const opts: Parameters<typeof trafficService.getCityTraffic>[2] = { modes: ['car'] };
  if (time) {
    opts.when = new Date(time);
  }

  const cityTraffic = await trafficService.getCityTraffic(fromCoords, toCoords, opts);

  if (!cityTraffic.car) {
    return res.status(502).json({ error: 'upstream_failure', message: 'Car traffic unavailable' });
  }

  logger.info({ from: fromCoords, to: toCoords, mode: 'car' }, 'Returned car traffic');
  return res.json(cityTraffic.car);
});

router.get('/transit', async (req, res) => {
  const parsed = CityQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'bad_request', message: LOCATION_INPUT_MESSAGE, issues: parsed.error.issues });
  }

  const { from, to, time } = parsed.data;
  let fromCoords: Coordinates;
  let toCoords: Coordinates;
  try {
    fromCoords = await parseCoordOrGeocode(from, (query) => tmapAdapter.geocode(query));
    toCoords = await parseCoordOrGeocode(to, (query) => tmapAdapter.geocode(query));
  } catch (error) {
    return res.status(400).json({ error: 'bad_request', message: (error as Error).message || LOCATION_INPUT_MESSAGE });
  }

  const opts: Parameters<typeof trafficService.getCityTraffic>[2] = { modes: ['transit'] };
  if (time) {
    opts.when = new Date(time);
  }

  const cityTraffic = await trafficService.getCityTraffic(fromCoords, toCoords, opts);

  if (!cityTraffic.transit) {
    return res.status(502).json({ error: 'upstream_failure', message: 'Transit traffic unavailable' });
  }

  logger.info({ from: fromCoords, to: toCoords, mode: 'transit' }, 'Returned transit traffic');
  return res.json(cityTraffic.transit);
});

router.get('/expressway', async (req, res) => {
  const parsed = ExpresswayQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'bad_request', message: LOCATION_INPUT_MESSAGE, issues: parsed.error.issues });
  }

  const { from, to, time } = parsed.data;
  let fromCoords: Coordinates;
  let toCoords: Coordinates;
  try {
    fromCoords = await parseCoordOrGeocode(from, (query) => tmapAdapter.geocode(query));
    toCoords = await parseCoordOrGeocode(to, (query) => tmapAdapter.geocode(query));
  } catch (error) {
    return res.status(400).json({ error: 'bad_request', message: (error as Error).message || LOCATION_INPUT_MESSAGE });
  }

  const opts: Parameters<typeof trafficService.getExpresswayTraffic>[2] = {};
  if (time) {
    opts.when = new Date(time);
  }

  const expressway = await trafficService.getExpresswayTraffic(fromCoords, toCoords, opts);

  logger.info({
    from: fromCoords,
    to: toCoords,
    meta: expressway.meta,
  }, 'Returned expressway traffic');
  return res.json(expressway);
});

export default router;
