import { Router } from 'express';
import * as palm from '../controllers/palmController.js';
import { readLimiter, writeLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { palmBody, userQuery } from '../validators/schemas.js';

const router = Router();

router.get ('/palm',         readLimiter,  validate(userQuery, 'query'), palm.getSavedPalm);
router.get ('/palm/history', readLimiter,  validate(userQuery, 'query'), palm.getPalmHistory);
router.get ('/palm/:id',     readLimiter,  validate(userQuery, 'query'), palm.getPalmById);
router.post('/palm',         writeLimiter, validate(palmBody,  'body'),  palm.analyzePalm);

export default router;
