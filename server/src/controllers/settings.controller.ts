/**
 * Settings 컨트롤러: Express/Lambda에서 재사용되는 기본 위치/설정 저장/조회 로직.
 * IMPLEMENTATION STATUS: OK (validation + geocoding + service wiring; unexpected errors bubble)
 */

import { z } from 'zod';
import { tmapAdapter } from '../adapters/tmap.adapter';
import type { UserLocationSetting, UserSettings } from '../types';
import { saveUserSettings, getUserSettings } from '../services/settings.service';
import { UpstreamError } from '../lib/errors';
import { ControllerResult } from './types';
import { logger } from '../lib/logger';

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

export async function getSettingsController(): Promise<ControllerResult<UserSettings>> {
  const settings = (await getUserSettings()) ?? {};
  return { statusCode: 200, body: settings };
}

export async function updateSettingsController(payload: unknown): Promise<ControllerResult> {
  try {
    const parsed = SettingsSchema.parse(payload);
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

    const saved = await saveUserSettings(undefined, patch);
    return { statusCode: 200, body: saved };
  } catch (error) {
    if (isSettingsError(error)) {
      const status = typeof error.status === 'number' ? error.status : 400;
      return {
        statusCode: status,
        body: {
          error: error.code ?? 'invalid_request',
          message: error.message,
        },
      };
    }
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Unexpected settings update failure'
    );
    throw error;
  }
}
