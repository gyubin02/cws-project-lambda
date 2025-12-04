/**
 * User settings persistence for Lambda/RDS migration.
 * IMPLEMENTATION STATUS:
 * - MySQL upsert/select/delete queries defined: OK
 * - JSON fallback for local/dev: OK
 * - Postgres/real RDS connectivity: TODO (requires AWS credentials)
 */

import { getDbClient } from '../lib/db';
import { logger } from '../lib/logger';
import { storeDelete, storeGet, storeSet } from '../lib/store';
import type { UserLocationSetting, UserSettings } from '../types';

const STORE_KEY = 'settings:global';
const DEFAULT_USER_ID = 'global';

type SettingsRow = {
  user_id: string;
  default_origin?: string | null;
  default_destination?: string | null;
  coordinate_lock?: number | boolean | null;
  last_updated?: string | Date | null;
};

function serializeLocation(value?: UserLocationSetting): string | null {
  if (!value) return null;
  return JSON.stringify(value);
}

function parseLocation(value?: string | null): UserLocationSetting | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as UserLocationSetting;
    return parsed;
  } catch {
    return undefined;
  }
}

function fromRow(row: SettingsRow): UserSettings {
  const settings: UserSettings = {};
  const origin = parseLocation(row.default_origin);
  const destination = parseLocation(row.default_destination);

  if (origin) settings.defaultOrigin = origin;
  if (destination) settings.defaultDestination = destination;

  if (typeof row.coordinate_lock === 'boolean') {
    settings.coordinateLock = row.coordinate_lock;
  } else if (row.coordinate_lock != null) {
    settings.coordinateLock = !!row.coordinate_lock;
  }

  return settings;
}

export async function getUserSettingsById(userId = DEFAULT_USER_ID): Promise<UserSettings | undefined> {
  const db = await getDbClient();
  if (db) {
    const sql = `
      SELECT user_id, default_origin, default_destination, coordinate_lock, last_updated
      FROM user_settings
      WHERE user_id = ?
      LIMIT 1;
    `;
    try {
      const rows = await db.query<SettingsRow>(sql, [userId]);
      const row = rows[0];
      if (row) return fromRow(row);
    } catch (error) {
      logger.warn(
        { user_id: userId, error: error instanceof Error ? error.message : error },
        'DB read failed; falling back to JSON store for settings'
      );
    }
  }

  return storeGet<UserSettings>(STORE_KEY);
}

export async function upsertUserSettings(
  userId: string,
  settings: UserSettings
): Promise<UserSettings> {
  const db = await getDbClient();
  if (db) {
    const sql = `
      INSERT INTO user_settings (
        user_id, default_origin, default_destination, coordinate_lock, last_updated
      )
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        default_origin = VALUES(default_origin),
        default_destination = VALUES(default_destination),
        coordinate_lock = VALUES(coordinate_lock),
        last_updated = VALUES(last_updated);
    `;

    try {
      await db.query(sql, [
        userId,
        serializeLocation(settings.defaultOrigin),
        serializeLocation(settings.defaultDestination),
        settings.coordinateLock ? 1 : 0,
        new Date().toISOString(),
      ]);
      logger.info({ user_id: userId }, 'Persisted settings to DB');
      return settings;
    } catch (error) {
      logger.warn(
        { user_id: userId, error: error instanceof Error ? error.message : error },
        'DB write failed; falling back to JSON store for settings'
      );
    }
  }

  await storeSet<UserSettings>(STORE_KEY, settings);
  return settings;
}

export async function deleteUserSettings(userId = DEFAULT_USER_ID): Promise<void> {
  const db = await getDbClient();
  if (db) {
    try {
      await db.query('DELETE FROM user_settings WHERE user_id = ?', [userId]);
      logger.info({ user_id: userId }, 'Deleted settings from DB');
    } catch (error) {
      logger.warn(
        { user_id: userId, error: error instanceof Error ? error.message : error },
        'DB delete failed; falling back to JSON store for settings'
      );
    }
  }

  await storeDelete(STORE_KEY);
}
