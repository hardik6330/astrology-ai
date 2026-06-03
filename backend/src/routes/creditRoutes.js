import { Router } from 'express';
import * as credit from '../controllers/creditController.js';
import { readLimiter } from '../middleware/rateLimit.js';

const router = Router();

// Current credit balance for the logged-in user — used by the clients to
// render the credit badge. The user is resolved from the auth token, so no
// query params are needed. Mounted behind requireAuth (see routes/index.js).
router.get('/credits', readLimiter, credit.getCredits);

export default router;
