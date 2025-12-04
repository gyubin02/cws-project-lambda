/**
 * Profile 컨트롤러: Express와 Lambda에서 재사용되는 프로필 CRUD 핸들러.
 * IMPLEMENTATION STATUS: OK (validation + service + JSON/DB persistence via repository)
 */

import { z } from 'zod';
import { logger } from '../lib/logger';
import { profileService, ProfileSchema } from '../services/profile.service';
import { ControllerResult } from './types';

const QuerySchema = z.object({
  user_id: z.string().min(1),
});

export async function createOrUpdateProfile(
  payload: unknown
): Promise<ControllerResult> {
  const parse = ProfileSchema.safeParse(payload);
  if (!parse.success) {
    logger.warn({ issues: parse.error.issues }, 'Invalid profile payload');
    return { statusCode: 400, body: { error: 'bad_request', issues: parse.error.issues } };
  }

  const saved = await profileService.saveProfile(parse.data);
  logger.info({ user_id: saved.user_id }, 'Profile saved');
  return { statusCode: 200, body: saved };
}

export async function getProfile(query: unknown): Promise<ControllerResult> {
  const parse = QuerySchema.safeParse(query);
  if (!parse.success) {
    logger.warn({ issues: parse.error.issues }, 'Invalid profile query');
    return { statusCode: 400, body: { error: 'bad_request', issues: parse.error.issues } };
  }

  const profile = await profileService.getProfile(parse.data.user_id);
  if (!profile) {
    return { statusCode: 404, body: { error: 'not_found' } };
  }

  return { statusCode: 200, body: profile };
}
