/**
 * User profile persistence for Lambda/RDS migration.
 * IMPLEMENTATION STATUS:
 * - Table schema + MySQL upsert/select queries: OK
 * - JSON file fallback for local/dev: OK
 * - Postgres/real RDS connectivity: TODO (requires AWS credentials)
 */

import { getDbClient } from '../lib/db';
import { logger } from '../lib/logger';
import { storeGet, storeSet } from '../lib/store';
import type { UserProfile } from '../types';

const STORE_PREFIX = 'profile:';

type ProfileRow = {
  user_id: string;
  preferred_mode: UserProfile['preferred_mode'];
  tz: string;
  home_lat: number;
  home_lon: number;
  home_label: string | null;
  home_district: string | null;
  work_lat: number;
  work_lon: number;
  work_label: string | null;
  updated_at?: string | Date | null;
};

function toKey(userId: string): string {
  return `${STORE_PREFIX}${userId}`;
}

function toRow(profile: UserProfile): ProfileRow {
  return {
    user_id: profile.user_id,
    preferred_mode: profile.preferred_mode,
    tz: profile.tz,
    home_lat: profile.home.lat,
    home_lon: profile.home.lon,
    home_label: profile.home.label ?? null,
    home_district: profile.home.district ?? null,
    work_lat: profile.work.lat,
    work_lon: profile.work.lon,
    work_label: profile.work.label ?? null,
    updated_at: profile.last_updated,
  };
}

function fromRow(row: ProfileRow): UserProfile {
  return {
    user_id: row.user_id,
    preferred_mode: row.preferred_mode,
    tz: row.tz,
    home: {
      lat: row.home_lat,
      lon: row.home_lon,
      ...(row.home_label ? { label: row.home_label } : {}),
      ...(row.home_district ? { district: row.home_district } : {}),
    },
    work: {
      lat: row.work_lat,
      lon: row.work_lon,
      ...(row.work_label ? { label: row.work_label } : {}),
    },
    last_updated: row.updated_at
      ? new Date(row.updated_at).toISOString()
      : new Date().toISOString(),
  };
}

export async function upsertUserProfile(profile: UserProfile): Promise<UserProfile> {
  const db = await getDbClient();
  const row = toRow(profile);

  if (db) {
    const mysqlQuery = `
      INSERT INTO user_profile (
        user_id, preferred_mode, tz,
        home_lat, home_lon, home_label, home_district,
        work_lat, work_lon, work_label,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        preferred_mode = VALUES(preferred_mode),
        tz = VALUES(tz),
        home_lat = VALUES(home_lat),
        home_lon = VALUES(home_lon),
        home_label = VALUES(home_label),
        home_district = VALUES(home_district),
        work_lat = VALUES(work_lat),
        work_lon = VALUES(work_lon),
        work_label = VALUES(work_label),
        updated_at = VALUES(updated_at);
    `;

    const updatedAt =
      row.updated_at != null ? new Date(row.updated_at).toISOString() : new Date().toISOString();

    try {
      await db.query(mysqlQuery, [
        row.user_id,
        row.preferred_mode,
        row.tz,
        row.home_lat,
        row.home_lon,
        row.home_label,
        row.home_district,
        row.work_lat,
        row.work_lon,
        row.work_label,
        updatedAt,
      ]);
      logger.info({ user_id: profile.user_id }, 'Persisted profile to DB');
      return profile;
    } catch (error) {
      logger.warn(
        { user_id: profile.user_id, error: error instanceof Error ? error.message : error },
        'DB write failed; falling back to JSON store for profile'
      );
    }
  }

  await storeSet<UserProfile>(toKey(profile.user_id), profile);
  return profile;
}

export async function getUserProfile(userId: string): Promise<UserProfile | undefined> {
  const db = await getDbClient();
  if (db) {
    const sql = `
      SELECT user_id, preferred_mode, tz,
             home_lat, home_lon, home_label, home_district,
             work_lat, work_lon, work_label,
             updated_at
      FROM user_profile
      WHERE user_id = ?
      LIMIT 1;
    `;
    try {
      const rows = await db.query<ProfileRow>(sql, [userId]);
      const row = rows[0];
      if (row) return fromRow(row);
    } catch (error) {
      logger.warn(
        { user_id: userId, error: error instanceof Error ? error.message : error },
        'DB read failed; falling back to JSON store for profile'
      );
    }
  }

  return storeGet<UserProfile>(toKey(userId));
}
