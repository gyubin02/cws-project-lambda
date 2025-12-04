import express from 'express';
import { geocodeHealthController, healthCheckController } from '../controllers/health.controller';

const router = express.Router();

router.get('/', async (req: any, res: any) => {
  try {
    const result = await healthCheckController(req.headers['x-request-id'] as string | undefined);
    return res.status(result.statusCode).json(result.body);
  } catch (error) {
    return res
      .status(500)
      .json({ ok: false, error: 'internal_error', message: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/geocode', async (req: any, res: any) => {
  const result = await geocodeHealthController(req.query?.addr as string | undefined);
  return res.status(result.statusCode).json(result.body);
});

export default router;
