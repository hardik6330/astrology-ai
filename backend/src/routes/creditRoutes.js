import { Router } from 'express';
import * as credit from '../controllers/creditController.js';
import { readLimiter, writeLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { purchaseBody, verifyPaymentBody, verifyIapBody } from '../validators/schemas.js';

const router = Router();

// Current credit balance for the logged-in user — used by the clients to
// render the credit badge. The user is resolved from the auth token, so no
// query params are needed. Mounted behind requireAuth (see routes/index.js).
router.get('/credits', readLimiter, credit.getCredits);

// Purchasable credit packages. Resolves the user from the auth token.
router.get('/credits/plans', readLimiter, credit.getPlans);

// Razorpay (web) buy flow: open an order, then verify the payment signature.
router.post('/credits/order', writeLimiter, validate(purchaseBody, 'body'), credit.createPurchaseOrder);
router.post('/credits/verify', writeLimiter, validate(verifyPaymentBody, 'body'), credit.verifyPurchase);
router.post('/credits/verify-iap', writeLimiter, validate(verifyIapBody, 'body'), credit.verifyIap);
// Subscriptions reuse the IAP body shape — same store payload, different
// verification path (expiry + renewal transaction instead of a one-off txn).
router.post('/credits/verify-subscription', writeLimiter, validate(verifyIapBody, 'body'), credit.verifySubscription);
router.get('/credits/subscription', credit.getSubscription);

// Legacy mock checkout — backward compat; 400s when Razorpay is live.
router.post('/credits/purchase', writeLimiter, validate(purchaseBody, 'body'), credit.buyPlan);

export default router;
