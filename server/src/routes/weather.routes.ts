import express from 'express';
import { getWeatherBriefController } from '../controllers/weather.controller';

const router = express.Router();

router.get('/', async (req: any, res: any, next: any) => {
  try {
    const params: {
      location?: string;
      lat?: string | number;
      lon?: string | number;
      time?: string;
      requestId?: string;
    } = {};

    if (req.query?.location) params.location = req.query.location as string;
    if (req.query?.lat) params.lat = req.query.lat as any;
    if (req.query?.lon) params.lon = req.query.lon as any;
    if (req.query?.time) params.time = req.query.time as string;
    if (req.headers['x-request-id']) params.requestId = req.headers['x-request-id'] as string;

    const result = await getWeatherBriefController(params);
    return res.status(result.statusCode).json(result.body);
  } catch (error) {
    next(error);
  }
});

export default router;
