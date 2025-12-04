import express from 'express';
import { getSettingsController, updateSettingsController } from '../controllers/settings.controller';

const router = express.Router();

router.get('/', async (_req: any, res: any, next: any) => {
  try {
    const result = await getSettingsController();
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: any, res: any, next: any) => {
  try {
    const result = await updateSettingsController(req.body);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    next(error);
  }
});

export default router;
