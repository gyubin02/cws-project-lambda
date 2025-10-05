import express from 'express';
import { z } from 'zod';
import { tmapAdapter } from '../adapters/tmap.adapter';
import type { UserSettings, UserLocationSetting } from '../types';
import { saveUserSettings, getUserSettings } from '../services/settings.service';
import { UpstreamError } from '../lib/errors';

const router = express.Router();

const MAX_PLACE_NAME_LENGTH = 128;

type SettingsError = Error & { status?: number; code?: string };

const LocationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Place name required')
    .max(MAX_PLACE_NAME_LENGTH, `Place name must be <= ${MAX_PLACE_NAME_LENGTH} characters`),
});

const SettingsSchema = z.object({
  defaultOrigin: LocationSchema.optional(),
  defaultDestination: LocationSchema.optional(),
  coordinateLock: z.boolean().optional(),
});

function sanitizePlaceName(name: string): string {
  return name.replace(/[\u0000-\u001f\u007f]/g, '').trim();
}

function makeError(code: string, message: string, status = 400): SettingsError {
  const error = new Error(message) as SettingsError;
  error.code = code;
  error.status = status;
  return error;
}

function isSettingsError(error: unknown): error is SettingsError {
  if (!error || typeof error !== 'object') return false;
  const maybe = error as SettingsError;
  return 'code' in maybe || 'status' in maybe;
}

async function resolveLocation(name: string): Promise<UserLocationSetting> {
  const sanitized = sanitizePlaceName(name);
  if (!sanitized) {
    throw makeError('invalid_place_name', 'Place name required');
  }

  try {
    const coordinates = await tmapAdapter.geocode(sanitized);
    return {
      name: sanitized,
      lat: coordinates.lat,
      lon: coordinates.lon,
      lastGeocodedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof UpstreamError) {
      if (error.code === 'bad_response') {
        throw makeError('location_not_found', `Location not found for "${sanitized}"`, 400);
      }
      throw makeError(
        error.code ?? 'upstream_error',
        error.message || 'Failed to resolve location',
        error.status ?? 503
      );
    }
    throw error;
  }
}

router.get('/', async (req: any, res: any, next: any) => {
  try {
    const settings = (await getUserSettings(req)) ?? {};
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: any, res: any, next: any) => {
  try {
    const parsed = SettingsSchema.parse(req.body);
    const patch: Partial<UserSettings> = {};

    if (parsed.defaultOrigin?.name) {
      patch.defaultOrigin = await resolveLocation(parsed.defaultOrigin.name);
    }

    if (parsed.defaultDestination?.name) {
      patch.defaultDestination = await resolveLocation(parsed.defaultDestination.name);
    }

    if (typeof parsed.coordinateLock === 'boolean') {
      patch.coordinateLock = parsed.coordinateLock;
    }

    const saved = await saveUserSettings(req, patch);
    res.status(200).json(saved);
  } catch (error) {
    if (error instanceof Error && isSettingsError(error)) {
      const status = typeof error.status === 'number' ? error.status : 400;
      return res.status(status).json({
        error: error.code ?? 'invalid_request',
        message: error.message,
      });
    }
    next(error);
  }
});

export default router;
