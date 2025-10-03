import { z } from 'zod';
import { storeGet, storeSet } from '../lib/store';
import type { UserProfile } from '../types';

export const CoordinatesSchema = z.object({
  lat: z.number(),
  lon: z.number(),
  label: z.string().optional(),
  district: z.string().optional(),
});

const WorkSchema = CoordinatesSchema.omit({ district: true });

export const ProfileSchema = z.object({
  user_id: z.string().min(1),
  preferred_mode: z.enum(['car', 'transit', 'bike', 'walk']),
  tz: z.string().min(1),
  home: CoordinatesSchema,
  work: WorkSchema,
});

const STORE_PREFIX = 'profile:';

function toKey(userId: string): string {
  return `${STORE_PREFIX}${userId}`;
}

export type ProfileInput = z.infer<typeof ProfileSchema>;

export class ProfileService {
  async saveProfile(input: ProfileInput): Promise<UserProfile> {
    const parsed = ProfileSchema.parse(input);
    const home: UserProfile['home'] = {
      lat: parsed.home.lat,
      lon: parsed.home.lon,
    };
    if (parsed.home.label) home.label = parsed.home.label;
    if (parsed.home.district) home.district = parsed.home.district;

    const work: UserProfile['work'] = {
      lat: parsed.work.lat,
      lon: parsed.work.lon,
    };
    if (parsed.work.label) work.label = parsed.work.label;

    const profile: UserProfile = {
      user_id: parsed.user_id,
      preferred_mode: parsed.preferred_mode,
      tz: parsed.tz,
      home,
      work,
      last_updated: new Date().toISOString(),
    };
    await storeSet<UserProfile>(toKey(profile.user_id), profile);
    return profile;
  }

  async getProfile(userId: string): Promise<UserProfile | undefined> {
    return storeGet<UserProfile>(toKey(userId));
  }
}

export const profileService = new ProfileService();
