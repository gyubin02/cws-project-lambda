import express from 'express';
import { z } from 'zod';
import { profileService, ProfileSchema } from '../services/profile.service';
import { logger } from '../lib/logger';

const router = express.Router();

const QuerySchema = z.object({
  user_id: z.string().min(1),
});

router.post('/', async (req: any, res: any) => {
  const parse = ProfileSchema.safeParse(req.body);
  if (!parse.success) {
    logger.warn({ issues: parse.error.issues }, 'Invalid profile payload');
    return res.status(400).json({ error: 'bad_request', issues: parse.error.issues });
  }

  const saved = await profileService.saveProfile(parse.data);
  logger.info({ user_id: saved.user_id }, 'Profile saved');
  return res.status(200).json(saved);
});

router.get('/', async (req: any, res: any) => {
  const parse = QuerySchema.safeParse(req.query);
  if (!parse.success) {
    logger.warn({ issues: parse.error.issues }, 'Invalid profile query');
    return res.status(400).json({ error: 'bad_request', issues: parse.error.issues });
  }

  const profile = await profileService.getProfile(parse.data.user_id);
  if (!profile) {
    return res.status(404).json({ error: 'not_found' });
  }

  return res.json(profile);
});

export default router;
