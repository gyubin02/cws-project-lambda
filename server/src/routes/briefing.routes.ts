import express from 'express';
import { z } from 'zod';
import { buildBriefing } from '../services/briefing.service';
import type { Coordinates, UserLocationSetting } from '../types';
import { LOCATION_INPUT_MESSAGE, isCoordinateLike, parseCoordinates } from '../lib/util';
import { tmapAdapter } from '../adapters/tmap.adapter';
import { getUserSettings } from '../services/settings.service';
import { liveOrMock } from '../lib/liveOrMock';
import { UpstreamError } from '../lib/errors';

const router = express.Router();

type LocationSource = 'stored' | 'geocoded' | 'request';

const QuerySchema = z.object({
  user_id: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  time: z.string().datetime().optional(),
});

function storedToCoordinates(setting?: UserLocationSetting | null): Coordinates | undefined {
  if (!setting) return undefined;
  if (typeof setting.lat !== 'number' || typeof setting.lon !== 'number') return undefined;
  return { lat: setting.lat, lon: setting.lon };
}

function pushWarning(warnings: string[], warning: string) {
  if (!warnings.includes(warning)) warnings.push(warning);
}

async function resolveLocation({
  label,
  requestValue,
  stored,
  coordinateLock,
  warnings,
}: {
  label: 'origin' | 'destination';
  requestValue?: string | undefined;
  stored?: UserLocationSetting | undefined;
  coordinateLock: boolean;
  warnings: string[];
}): Promise<{ coordinates?: Coordinates; source?: LocationSource; error?: { status: number; message: string; code: string } }> {
  const storedCoords = storedToCoordinates(stored);

  if (coordinateLock && storedCoords) {
    return { coordinates: storedCoords, source: 'stored' };
  }

  const trimmed = requestValue?.trim();

  if (trimmed) {
    if (isCoordinateLike(trimmed)) {
      try {
        return { coordinates: parseCoordinates(trimmed), source: 'request' };
      } catch (error) {
        const message = error instanceof Error ? error.message : LOCATION_INPUT_MESSAGE;
        return { error: { status: 400, message, code: 'invalid_coordinates' } };
      }
    }

    try {
      const coordinates = await tmapAdapter.geocode(trimmed);
      return { coordinates, source: 'geocoded' };
    } catch (error) {
      if (storedCoords) {
        pushWarning(warnings, 'geocode_unavailable_used_stored_coords');
        return { coordinates: storedCoords, source: 'stored' };
      }

      if (error instanceof UpstreamError) {
        const status = error.code === 'bad_response' ? 400 : error.status ?? 503;
        const code = error.code === 'bad_response' ? 'location_not_found' : error.code ?? 'upstream_error';
        return {
          error: {
            status,
            code,
            message: error.message || LOCATION_INPUT_MESSAGE,
          },
        };
      }

      const message = error instanceof Error ? error.message : LOCATION_INPUT_MESSAGE;
      return { error: { status: 400, code: 'invalid_request', message } };
    }
  }

  if (storedCoords) {
    return { coordinates: storedCoords, source: 'stored' };
  }

  return {
    error: {
      status: 400,
      code: 'missing_location',
      message: `${label} is required. Provide a place name or lat,lon value or configure defaults.`,
    },
  };
}

router.get('/', async (req: any, res: any) => {
  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'bad_request', message: LOCATION_INPUT_MESSAGE, issues: parsed.error.issues });
  }

  const { user_id, from, to, time } = parsed.data;
  const when = time ? new Date(time) : undefined;

  try {
    const settings = await getUserSettings(req);
    const coordinateLock = !!settings?.coordinateLock;

    const warnings: string[] = [];

    const originResult = await resolveLocation({
      label: 'origin',
      requestValue: from,
      stored: settings?.defaultOrigin,
      coordinateLock,
      warnings,
    });
    if (originResult.error) {
      return res.status(originResult.error.status).json({
        error: originResult.error.code,
        message: originResult.error.message,
      });
    }

    const destinationResult = await resolveLocation({
      label: 'destination',
      requestValue: to,
      stored: settings?.defaultDestination,
      coordinateLock,
      warnings,
    });
    if (destinationResult.error) {
      return res.status(destinationResult.error.status).json({
        error: destinationResult.error.code,
        message: destinationResult.error.message,
      });
    }

    const options: Parameters<typeof buildBriefing>[0] = {};
    if (user_id) options.userId = user_id;
    if (originResult.coordinates) options.from = originResult.coordinates;
    if (destinationResult.coordinates) options.to = destinationResult.coordinates;
    if (when) options.when = when;

    const briefing = await buildBriefing(options);

    const originSource: LocationSource = originResult.source ?? 'request';
    const destinationSource: LocationSource = destinationResult.source ?? 'request';

    const meta = {
      origin: { source: originSource },
      destination: { source: destinationSource },
      warnings,
      sources: {
        traffic: {
          car: liveOrMock('tmap'),
          transit: liveOrMock('tmap'),
          expressway: liveOrMock('expressway'),
        },
        weather: liveOrMock('kma'),
        air: liveOrMock('airkorea'),
      },
    };

    return res.json({ data: briefing, meta });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'Profile not found') {
      return res.status(404).json({ error: 'not_found', message });
    }
    return res.status(400).json({ error: 'bad_request', message });
  }
});

export default router;
