// Chart memory — the user's Timeline Check answers and asked Gochar alignments.
// Mounted behind the shared requireAuth in routes/index.js.

import { Router } from 'express';
import * as memory from '../controllers/memoryController.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { memorySetBody } from '../validators/schemas.js';

const router = Router();

router.get('/memory', memory.getMemory);
router.post('/memory', writeLimiter, validate(memorySetBody, 'body'), memory.setMemory);

export default router;
