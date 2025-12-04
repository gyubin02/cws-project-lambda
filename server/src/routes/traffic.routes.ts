import express from 'express';
import {
  getCarTrafficController,
  getTransitTrafficController,
  getCityTrafficController,
  getExpresswayTrafficController,
  getRouteTollgatesController,
} from '../controllers/traffic.controller';

const router = express.Router();

router.get('/car', async (req: any, res: any, next: any) => {
  try {
    const result = await getCarTrafficController(req.query);
    return res.status(result.statusCode).json(result.body);
  } catch (error) {
    next(error);
  }
});

router.get('/transit', async (req: any, res: any, next: any) => {
  try {
    const result = await getTransitTrafficController(req.query);
    return res.status(result.statusCode).json(result.body);
  } catch (error) {
    next(error);
  }
});

router.get('/city', async (req: any, res: any, next: any) => {
  try {
    const result = await getCityTrafficController(req.query);
    return res.status(result.statusCode).json(result.body);
  } catch (error) {
    next(error);
  }
});

router.get('/expressway', async (req: any, res: any, next: any) => {
  try {
    const result = await getExpresswayTrafficController(req.query);
    return res.status(result.statusCode).json(result.body);
  } catch (error) {
    next(error);
  }
});

router.get('/route-tollgates', async (req: any, res: any, next: any) => {
  try {
    const result = await getRouteTollgatesController(req.query);
    return res.status(result.statusCode).json(result.body);
  } catch (error) {
    next(error);
  }
});

export default router;
