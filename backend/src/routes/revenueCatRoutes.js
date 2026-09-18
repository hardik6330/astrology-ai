import { Router } from 'express';
import { env } from '../config/envConfig.js';
import { safeEqual } from '../middleware/cronAuth.js';
import { validate } from '../middleware/validate.js';
import { rcWebhookBody } from '../validators/schemas.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../errors/AppError.js';
import { handleEvent } from '../services/revenueCatService.js';

const router = Router();

// RC sends the dashboard's "Authorization header value" verbatim; accept it
// bare or Bearer-prefixed. Constant-time compare, same as the cron secret.
function requireRcSecret(req, _res, next) {
  if (!env.REVENUECAT_WEBHOOK_SECRET) {
    return next(AppError.http(503, 'RevenueCat not configured', 'RC_NOT_CONFIGURED'));
  }
  const provided = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!provided || !safeEqual(provided, env.REVENUECAT_WEBHOOK_SECRET)) {
    return next(AppError.unauthorized());
  }
  next();
}

// POST /credits/rc-webhook — RevenueCat → credit ledger. Always 200 once the
// event is understood (RC retries on non-2xx, so a permanent reject must not
// look like a transient failure); a thrown DB error → 500 → RC retries.
router.post('/credits/rc-webhook', requireRcSecret, validate(rcWebhookBody, 'body'),
  asyncHandler(async (req, res) => {
    res.locals.message = 'Webhook processed';
    res.json(await handleEvent(req.body.event));
  }));

export default router;
