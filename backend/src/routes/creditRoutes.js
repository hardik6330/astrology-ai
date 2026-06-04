import { Router } from 'express';
import * as credit from '../controllers/creditController.js';
import { readLimiter, writeLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { purchaseBody } from '../validators/schemas.js';

const router = Router();

// Current credit balance for the logged-in user — used by the clients to
// render the credit badge. The user is resolved from the auth token, so no
// query params are needed. Mounted behind requireAuth (see routes/index.js).
router.get('/credits', readLimiter, credit.getCredits);

// Purchasable credit packages, and the (mock) buy endpoint. Both resolve the
// user from the auth token. Mounted behind requireAuth (see routes/index.js).
router.get('/credits/plans', readLimiter, credit.getPlans);
router.post('/credits/purchase', writeLimiter, validate(purchaseBody, 'body'), credit.buyPlan);

export default router;
