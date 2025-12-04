import express from 'express';
import { getAirBriefController } from '../controllers/air.controller';

const router = express.Router();

router.get('/', async (req: any, res: any, next: any) => {
  try {
    const params: {
      location?: string;
      lat?: string | number;
      lon?: string | number;
      district?: string;
      requestId?: string;
    } = {};

    if (req.query?.location) params.location = req.query.location as string;
    if (req.query?.lat) params.lat = req.query.lat as any;
    if (req.query?.lon) params.lon = req.query.lon as any;
    if (req.query?.district) params.district = req.query.district as string;
    if (req.headers['x-request-id']) params.requestId = req.headers['x-request-id'] as string;

    const result = await getAirBriefController(params);
    return res.status(result.statusCode).json(result.body);
  } catch (error) {
    next(error);
  }
});

export default router;
