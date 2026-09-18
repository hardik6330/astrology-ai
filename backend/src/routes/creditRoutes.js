import { Router } from 'express';
import * as credit from '../controllers/creditController.js';
import { readLimiter } from '../middleware/rateLimit.js';

const router = Router();

// Current credit balance for the logged-in user — used by the clients to
// render the credit badge. The user is resolved from the auth token, so no
// query params are needed. Mounted behind requireAuth (see routes/index.js).
router.get('/credits', readLimiter, credit.getCredits);

// Purchasable credit packages. Resolves the user from the auth token.
router.get('/credits/plans', readLimiter, credit.getPlans);

// Purchases settle through RevenueCat → /credits/rc-webhook (revenueCatRoutes);
// the client only reads plans + subscription state here.
router.get('/credits/subscription', credit.getSubscription);

export default router;
