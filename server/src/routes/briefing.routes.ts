import express from 'express';
import { z } from 'zod';
import { buildBriefing } from '../services/briefing.service';
import type { Coordinates } from '../types';
import { parseCoordOrGeocode, COORDINATE_REGEX, LOCATION_INPUT_MESSAGE } from '../lib/util';
import { tmapAdapter } from '../adapters/tmap.adapter';

const router = express.Router();

const locationSchema = z.union([
  z.string().regex(COORDINATE_REGEX, { message: LOCATION_INPUT_MESSAGE }),
  z.string().min(1, LOCATION_INPUT_MESSAGE),
]);

const QuerySchema = z.object({
  user_id: z.string().optional(),
  from: locationSchema.optional(),
  to: locationSchema.optional(),
  time: z.string().datetime().optional(),
}).refine(
  (data) => !!data.user_id || (!!data.from && !!data.to),
  { message: 'Provide user_id or both from/to values.' }
);

router.get('/', async (req: any, res: any) => {
  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'bad_request', message: LOCATION_INPUT_MESSAGE, issues: parsed.error.issues });
  }

  const { user_id, from, to, time } = parsed.data;
  const when = time ? new Date(time) : undefined;

  try {
    let fromCoords: Coordinates | undefined;
    let toCoords: Coordinates | undefined;
    try {
      fromCoords = from ? await parseCoordOrGeocode(from, (query) => tmapAdapter.geocode(query)) : undefined;
      toCoords = to ? await parseCoordOrGeocode(to, (query) => tmapAdapter.geocode(query)) : undefined;
    } catch (coordError) {
      return res.status(400).json({ error: 'bad_request', message: (coordError as Error).message || LOCATION_INPUT_MESSAGE });
    }

    const options: Parameters<typeof buildBriefing>[0] = {};
    if (user_id) options.userId = user_id;
    if (fromCoords) options.from = fromCoords;
    if (toCoords) options.to = toCoords;
    if (when) options.when = when;

    const briefing = await buildBriefing(options);
    return res.json(briefing);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'Profile not found') {
      return res.status(404).json({ error: 'not_found', message });
    }
    return res.status(400).json({ error: 'bad_request', message });
  }
});

export default router;
