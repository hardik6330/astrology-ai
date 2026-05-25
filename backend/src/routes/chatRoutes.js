import { Router } from 'express';
import * as chat from '../controllers/chatController.js';
import { readLimiter, writeLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { chatBody, userQuery } from '../validators/schemas.js';

const router = Router();

router.get ('/chat', readLimiter,  validate(userQuery, 'query'), chat.getChatHistory);
router.post('/chat', writeLimiter, validate(chatBody, 'body'),   chat.chatWithAstrologer);

export default router;
