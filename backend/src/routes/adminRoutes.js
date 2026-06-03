// Back-office admin endpoints. Login is public (rate-limited); everything
// behind requireAdmin needs a role:'admin' JWT.

import { Router } from 'express';
import * as admin from '../controllers/adminController.js';
import { requireAdmin } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { adminLoginBody, adminBroadcastBody } from '../validators/schemas.js';

const router = Router();

router.post('/admin/login', writeLimiter, validate(adminLoginBody, 'body'), admin.login);

// Everything below requires a valid admin session.
router.get ('/admin/me',    requireAdmin, admin.me);
router.get ('/admin/stats', requireAdmin, admin.stats);
router.get ('/admin/users', requireAdmin, admin.users);
router.post('/admin/push/broadcast', requireAdmin, validate(adminBroadcastBody, 'body'), admin.broadcast);
router.post('/admin/users/:id/push', requireAdmin, validate(adminBroadcastBody, 'body'), admin.pushUser);

export default router;
