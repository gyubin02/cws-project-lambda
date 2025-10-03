import { Router } from 'express';
import { z } from 'zod';
import { buildBriefing } from '../services/briefing.service';

const router = Router();

const QSchema = z.object({
  lat: z.coerce.number(),
  lon: z.coerce.number(),
  from: z.string().min(1),
  to: z.string().min(1),
});

router.get('/', async (req, res) => {
  const parse = QSchema.safeParse(req.query);
  if (!parse.success) return res.status(400).json({ error: 'bad_request', issues: parse.error.issues });

  try {
    const data = await buildBriefing(
      parse.data.lat, parse.data.lon, parse.data.from, parse.data.to
    );
    return res.json(data);
  } catch (err: any) {
    return res.status(502).json({ error: 'upstream_failure', message: String(err.message) });
  }
});

export default router;
