import * as chat from '../services/chatService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { withAuthPhone } from '../utils/authForm.js';

export const getChatHistory = asyncHandler(async (req, res) => {
  const messages = await chat.getChatHistory(withAuthPhone(req, req.query));
  res.json({ messages });
});

export const chatWithAstrologer = asyncHandler(async (req, res) => {
  // Service returns { content, balance }. The chart form is optional here; when
  // present, bind it to the caller's own phone so chat can only ever be charged
  // to — and persisted under — the authenticated account.
  const form = req.body.form ? withAuthPhone(req, req.body.form) : undefined;
  res.json(await chat.answerAndPersist({ ...req.body, form }));
});
