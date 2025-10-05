import type { UserLocationSetting, UserSettings } from '../types';
import { storeDelete, storeGet, storeSet } from '../lib/store';

const STORE_KEY = 'settings:global';

function cloneLocation(setting?: UserLocationSetting): UserLocationSetting | undefined {
  if (!setting) return undefined;
  const { name, lat, lon, lastGeocodedAt } = setting;
  const cloned: UserLocationSetting = { name };
  if (typeof lat === 'number') cloned.lat = lat;
  if (typeof lon === 'number') cloned.lon = lon;
  if (lastGeocodedAt) cloned.lastGeocodedAt = lastGeocodedAt;
  return cloned;
}

function normalizeSettings(settings?: UserSettings | null): UserSettings | undefined {
  if (!settings) return undefined;
  const normalized: UserSettings = {};
  if (settings.defaultOrigin) {
    const originClone = cloneLocation(settings.defaultOrigin);
    if (originClone) {
      normalized.defaultOrigin = originClone;
    }
  }
  if (settings.defaultDestination) {
    const destinationClone = cloneLocation(settings.defaultDestination);
    if (destinationClone) {
      normalized.defaultDestination = destinationClone;
    }
  }
  normalized.coordinateLock = typeof settings.coordinateLock === 'boolean'
    ? settings.coordinateLock
    : false;
  return normalized;
}

export async function getUserSettings(_ctx?: unknown): Promise<UserSettings | undefined> {
  const stored = await storeGet<UserSettings>(STORE_KEY);
  const normalized = normalizeSettings(stored);
  return normalized ?? { coordinateLock: false };
}

export async function saveUserSettings(
  _ctx: unknown,
  patch: Partial<UserSettings>
): Promise<UserSettings> {
  const current = (await getUserSettings()) ?? {};
  const next: UserSettings = { ...current };

  if (patch.defaultOrigin !== undefined) {
    const originClone = cloneLocation(patch.defaultOrigin);
    if (originClone) {
      next.defaultOrigin = originClone;
    } else {
      delete next.defaultOrigin;
    }
  }

  if (patch.defaultDestination !== undefined) {
    const destinationClone = cloneLocation(patch.defaultDestination);
    if (destinationClone) {
      next.defaultDestination = destinationClone;
    } else {
      delete next.defaultDestination;
    }
  }

  if (typeof patch.coordinateLock === 'boolean') {
    next.coordinateLock = patch.coordinateLock;
  } else if (next.coordinateLock === undefined) {
    next.coordinateLock = false;
  }

  await storeSet(STORE_KEY, next);
  return next;
}

export async function clearUserSettings(): Promise<void> {
  await storeDelete(STORE_KEY);
}
