import * as chat from '../services/chatService.js';

export async function getChatHistory(req, res, next) {
  try {
    const messages = await chat.getChatHistory(req.query);
    res.json({ messages });
  } catch (err) { next(err); }
}

export async function chatWithAstrologer(req, res, next) {
  try {
    const content = await chat.answerAndPersist(req.body);
    res.json({ content });
  } catch (err) { next(err); }
}
