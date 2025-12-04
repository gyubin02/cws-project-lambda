import express from 'express';
import { createOrUpdateProfile, getProfile } from '../controllers/profile.controller';

const router = express.Router();

router.post('/', async (req: any, res: any, next: any) => {
  try {
    const result = await createOrUpdateProfile(req.body);
    return res.status(result.statusCode).json(result.body);
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req: any, res: any, next: any) => {
  try {
    const result = await getProfile(req.query);
    return res.status(result.statusCode).json(result.body);
  } catch (error) {
    next(error);
  }
});

export default router;
