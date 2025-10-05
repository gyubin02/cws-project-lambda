/**
 * 대기질 라우트
 */

import express from 'express';
import { z } from 'zod';
import { airService } from '../services/air.service';
import { logger } from '../lib/logger';
import { UpstreamError } from '../lib/errors';
import { getUserSettings } from '../services/settings.service';
import { LOCATION_INPUT_MESSAGE, isCoordinateLike, parseCoordinates } from '../lib/util';
import { tmapAdapter } from '../adapters/tmap.adapter';

const router = express.Router();

const AirQuerySchema = z.object({
  location: z.string().optional(),
  lat: z.union([z.string(), z.number()]).optional(),
  lon: z.union([z.string(), z.number()]).optional(),
  district: z.string().optional(),
});

type LocationSource = 'stored' | 'geocoded' | 'request';

function parseMaybeNumber(value?: string | number): number | undefined {
  if (value === undefined || value === null) return undefined;
  const num = typeof value === 'number' ? value : Number(String(value));
  if (!Number.isFinite(num)) return undefined;
  return num;
}

function storedToCoordinates(setting?: { lat?: number; lon?: number } | null) {
  if (!setting || typeof setting.lat !== 'number' || typeof setting.lon !== 'number') {
    return undefined;
  }
  return { lat: setting.lat, lon: setting.lon };
}

function pushWarning(warnings: string[], warning: string) {
  if (!warnings.includes(warning)) warnings.push(warning);
}

async function resolveAirLocation({
  locationValue,
  latValue,
  lonValue,
  coordinateLock,
  stored,
  warnings,
}: {
  locationValue?: string | undefined;
  latValue?: string | number | undefined;
  lonValue?: string | number | undefined;
  coordinateLock: boolean;
  stored?: { lat?: number; lon?: number } | null | undefined;
  warnings: string[];
}): Promise<{
  coordinates?: { lat: number; lon: number };
  source?: LocationSource;
  error?: { status: number; code: string; message: string };
}> {
  const storedCoords = storedToCoordinates(stored);

  if (coordinateLock && storedCoords) {
    return { coordinates: storedCoords, source: 'stored' };
  }

  let locationError: { status: number; code: string; message: string } | undefined;
  const trimmed = locationValue?.trim();

  if (trimmed) {
    if (isCoordinateLike(trimmed)) {
      try {
        return { coordinates: parseCoordinates(trimmed), source: 'request' };
      } catch (error) {
        const message = error instanceof Error ? error.message : LOCATION_INPUT_MESSAGE;
        return { error: { status: 400, code: 'invalid_coordinates', message } };
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
        locationError = {
          status,
          code,
          message: error.message || LOCATION_INPUT_MESSAGE,
        };
      } else {
        const message = error instanceof Error ? error.message : LOCATION_INPUT_MESSAGE;
        locationError = { status: 400, code: 'invalid_request', message };
      }
    }
  }

  const latNum = parseMaybeNumber(latValue);
  const lonNum = parseMaybeNumber(lonValue);
  if (latNum != null && lonNum != null) {
    if (latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
      return {
        error: {
          status: 400,
          code: 'invalid_coordinates',
          message: 'Coordinates out of range (lat ±90, lon ±180).',
        },
      };
    }
    return { coordinates: { lat: latNum, lon: lonNum }, source: 'request' };
  }

  if (storedCoords) {
    if (locationError) {
      pushWarning(warnings, 'geocode_unavailable_used_stored_coords');
    }
    return { coordinates: storedCoords, source: 'stored' };
  }

  if (locationError) {
    return { error: locationError };
  }

  return {
    error: {
      status: 400,
      code: 'missing_location',
      message: 'Location is required. Provide location=<name|lat,lon> or lat & lon.',
    },
  };
}

router.get('/', async (req: any, res: any) => {
  const reqId = req.headers['x-request-id'] as string;

  try {
    logger.info({ reqId, query: req.query }, 'Air quality request received');

    const parseResult = AirQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      logger.warn({ reqId, errors: parseResult.error.errors }, 'Invalid request parameters');
      return res.status(400).json({
        error: 'invalid_request',
        message: LOCATION_INPUT_MESSAGE,
        details: parseResult.error.errors,
      });
    }

    const { location, lat, lon, district } = parseResult.data;
    const settings = await getUserSettings(req);
    const coordinateLock = !!settings?.coordinateLock;
    const warnings: string[] = [];

    const locationResult = await resolveAirLocation({
      locationValue: location,
      latValue: lat,
      lonValue: lon,
      coordinateLock,
      stored: settings?.defaultOrigin,
      warnings,
    });

    if (locationResult.error) {
      return res.status(locationResult.error.status).json({
        error: locationResult.error.code,
        message: locationResult.error.message,
      });
    }

    const coordinates = locationResult.coordinates!;
    const airBrief = await airService.getAirBrief(coordinates, district);

    logger.info({
      reqId,
      pm10: airBrief.pm10,
      pm25: airBrief.pm25,
      grade: airBrief.grade,
      status: airBrief.source_status,
    }, 'Air quality data retrieved successfully');

    const source: LocationSource = locationResult.source ?? 'request';

    const meta = {
      location: { source },
      warnings,
    };

    return res.json({ data: airBrief, meta });
  } catch (error) {
    logger.error({
      reqId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, 'Air quality request failed');

    if (error instanceof UpstreamError) {
      return res.status(error.status || 500).json({
        error: error.code ?? 'upstream_error',
        message: error.message,
      });
    }

    return res.status(500).json({
      error: 'internal_error',
      message: 'Internal server error',
    });
  }
});

export default router;
