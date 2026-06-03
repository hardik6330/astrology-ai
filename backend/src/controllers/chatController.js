import * as chat from '../services/chatService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getChatHistory = asyncHandler(async (req, res) => {
  const messages = await chat.getChatHistory(req.query);
  res.json({ messages });
});

export const chatWithAstrologer = asyncHandler(async (req, res) => {
  // Service returns { content, balance }.
  res.json(await chat.answerAndPersist(req.body));
});
