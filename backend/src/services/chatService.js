import { ChatMessage } from '../models/index.js';
import { callGemini } from '../ai/gemini.js';
import { CHAT_SYSTEM, GUARD_SYSTEM } from '../ai/prompts.js';
import { findOrCreateUser, findUserByForm } from './userService.js';
import { logger } from '../config/logger.js';

const log = logger.child({ mod: 'chat' });

// GET chat history for a user — used to restore the conversation on refresh.
export async function getChatHistory(form) {
  const user = await findUserByForm(form);
  if (!user) return [];
  const rows = await ChatMessage.findAll({
    where: { userId: user.id },
    order: [['createdAt', 'ASC']],
    attributes: ['role', 'content'],
  });
  return rows.map((r) => ({ role: r.role, content: r.content }));
}

// Answer one user turn against the chart, then persist the exchange.
export async function answerAndPersist({ messages, factSheet, form }) {
  const lastMsg = messages[messages.length - 1].content;

  // 1. Topic guard — refuse off-chart questions.
  const guardRes = await callGemini(GUARD_SYSTEM, lastMsg);
  let result;
  if (guardRes.trim().toUpperCase() === 'BLOCK') {
    result = 'I can only answer questions about your own birth chart. 🔮';
  } else {
    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const systemWithChart = `${CHAT_SYSTEM}\n\n=== THIS PERSON'S BIRTH CHART ===\n${factSheet || '(chart not provided)'}\n\nTODAY'S DATE: ${today}.`;
    result = await callGemini(systemWithChart, lastMsg);
  }

  // 2. Persist exchange (best-effort).
  if (form?.name && form.date && form.time && form.city) {
    try {
      const user = await findOrCreateUser(form);
      await ChatMessage.bulkCreate([
        { userId: user.id, role: 'user',      content: lastMsg },
        { userId: user.id, role: 'assistant', content: result  },
      ]);
    } catch (saveError) {
      log.error({ err: saveError }, 'Chat save failed');
    }
  }

  return result;
}
