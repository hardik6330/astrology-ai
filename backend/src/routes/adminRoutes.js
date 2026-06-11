// Back-office admin endpoints. Login is public (rate-limited); everything
// behind requireAdmin needs a role:'admin' JWT.

import { Router } from 'express';
import * as admin from '../controllers/adminController.js';
import { requireAdmin } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import {
  adminLoginBody, adminBroadcastBody, adminSettingsBody,
  adminPlanCreateBody, adminPlanUpdateBody,
} from '../validators/schemas.js';

const router = Router();

router.post('/admin/login', writeLimiter, validate(adminLoginBody, 'body'), admin.login);

// Everything below requires a valid admin session.
router.get ('/admin/me',    requireAdmin, admin.me);
router.get ('/admin/stats', requireAdmin, admin.stats);
router.get ('/admin/users', requireAdmin, admin.users);
router.get ('/admin/purchases', requireAdmin, admin.buyers);
router.post('/admin/push/broadcast', requireAdmin, validate(adminBroadcastBody, 'body'), admin.broadcast);
router.post('/admin/users/:id/push', requireAdmin, validate(adminBroadcastBody, 'body'), admin.pushUser);

router.get ('/admin/settings', requireAdmin, admin.settings);
router.post('/admin/settings', requireAdmin, validate(adminSettingsBody, 'body'), admin.saveSettings);

// Credit-plan CRUD (no delete — plans are soft-disabled via `active`).
router.get ('/admin/plans',     requireAdmin, admin.plans);
router.post('/admin/plans',     requireAdmin, validate(adminPlanCreateBody, 'body'), admin.createPlan);
router.put ('/admin/plans/:id', requireAdmin, validate(adminPlanUpdateBody, 'body'), admin.updatePlan);

export default router;
