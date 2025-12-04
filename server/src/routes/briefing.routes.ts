import express from 'express';
import { getBriefingController } from '../controllers/briefing.controller';

const router = express.Router();

router.get('/', async (req: any, res: any, next: any) => {
  try {
    const params: { user_id?: string; from?: string; to?: string; time?: string } = {};
    if (req.query?.user_id) params.user_id = req.query.user_id as string;
    if (req.query?.from) params.from = req.query.from as string;
    if (req.query?.to) params.to = req.query.to as string;
    if (req.query?.time) params.time = req.query.time as string;

    const result = await getBriefingController(params);
    return res.status(result.statusCode).json(result.body);
  } catch (error) {
    next(error);
  }
});

export default router;
