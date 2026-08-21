import { Router } from 'express';
import * as chat from '../controllers/chatController.js';
import { readLimiter, writeLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { chatBody, userQuery } from '../validators/schemas.js';

const router = Router();

router.get ('/chat', readLimiter,  validate(userQuery, 'query'), chat.getChatHistory);
router.post('/chat', writeLimiter, validate(chatBody, 'body'),   chat.chatWithAstrologer);
// Same body, same limiter, same schema — only the transport differs. Kept as a
// separate path so a client that can't stream keeps working unchanged.
router.post('/chat/stream', writeLimiter, validate(chatBody, 'body'), chat.chatWithAstrologerStream);

export default router;
