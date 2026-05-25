import { Router } from 'express';
import * as kundali from '../controllers/kundaliController.js';
import { readLimiter, writeLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { interpretBody, userQuery } from '../validators/schemas.js';

const router = Router();

router.get ('/interpret', readLimiter,  validate(userQuery, 'query'), kundali.getSavedInterpretation);
router.post('/interpret', writeLimiter, validate(interpretBody, 'body'), kundali.interpretChart);

export default router;
