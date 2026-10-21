import { Router } from 'express';
import { getReport } from '../controllers/reports.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validateQuery } from '../validators/validateBody.js';
import { reportQuerySchema } from '../validators/report.validator.js';

const router = Router();

router.get('/monthly', requireAuth, validateQuery(reportQuerySchema), getReport);

export default router;
