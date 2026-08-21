import * as chat from '../services/chatService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { withAuthPhone } from '../utils/authForm.js';
import { openSse } from '../utils/sse.js';

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

// Streaming twin of chatWithAstrologer. Same service call, same validation, same
// credit accounting — the only difference is that the answer arrives in pieces.
//
// NOT wrapped in asyncHandler: once the SSE headers are out, the error handler
// can't turn a throw into a JSON 4xx/5xx response any more. So errors are caught
// here and delivered as an SSE error event with the same { message, code } the
// REST path returns, which is what lets the client reuse its INSUFFICIENT_CREDITS
// handling unchanged.
export const chatWithAstrologerStream = async (req, res) => {
  const form = req.body.form ? withAuthPhone(req, req.body.form) : undefined;
  const sse = openSse(res);
  // A client that navigates away mid-answer shouldn't keep Gemini streaming into
  // a dead socket; the service still persists what it got, so nothing is charged
  // for nothing.
  let aborted = false;
  req.on('close', () => { aborted = true; });

  try {
    const { content, balance, blocked } = await chat.answerAndPersist(
      { ...req.body, form },
      (delta) => { if (!aborted) sse.send({ delta }); },
    );
    // A blocked (off-topic) answer never streams — the guard refuses before the
    // answer call — so send its canned reply as one delta to keep the client's
    // rendering path identical.
    if (blocked) sse.send({ delta: content });
    sse.close({ done: true, balance, blocked: Boolean(blocked) });
  } catch (err) {
    sse.close({ error: err.message, code: err.code || 'AI_ERROR' });
  }
};
