import { ChatMessage } from '../models/index.js';
import { callGemini } from '../ai/gemini.js';
import { CHAT_SYSTEM, GUARD_SYSTEM } from '../ai/prompts.js';
import { findOrCreateUser, findUserByForm } from './userService.js';
import { logger } from '../config/logger.js';

const log = logger.child({ mod: 'chat' });

// Topic keywords across English / Hindi (romanised) / Gujarati (romanised + script).
// Used to recognise when a follow-up question revisits an earlier topic so we
// can replay the relevant prior Q&A pairs as context.
const TOPIC_KEYWORDS = {
  career:   ['career', 'job', 'work', 'business', 'profession', 'salary', 'promotion', 'office', 'naukri', 'kaam', 'dhandho', 'naukari', 'કારકિર્દી', 'નોકરી', 'કામ', 'ધંધો'],
  marriage: ['marriage', 'marry', 'spouse', 'wife', 'husband', 'partner', 'relationship', 'love', 'shaadi', 'lagna', 'pyar', 'prem', 'લગ્ન', 'પ્રેમ', 'જીવનસાથી'],
  health:   ['health', 'illness', 'disease', 'sick', 'body', 'fitness', 'mental', 'tabiyat', 'sehat', 'bimari', 'સ્વાસ્થ્ય', 'તબિયત', 'બીમારી'],
  money:    ['money', 'wealth', 'finance', 'income', 'rich', 'debt', 'loan', 'invest', 'paisa', 'dhan', 'kamai', 'પૈસા', 'ધન', 'કમાણી', 'આવક'],
  family:   ['family', 'parents', 'mother', 'father', 'children', 'kids', 'son', 'daughter', 'sibling', 'parivar', 'maa', 'pita', 'bachche', 'પરિવાર', 'માતા', 'પિતા', 'બાળકો'],
  timing:   ['when', 'time', 'date', 'year', 'month', 'kab', 'kyare', 'ક્યારે'],
  travel:   ['travel', 'abroad', 'foreign', 'videsh', 'pravas', 'વિદેશ', 'પ્રવાસ'],
  education:['study', 'studies', 'education', 'exam', 'college', 'degree', 'padhai', 'shiksha', 'અભ્યાસ', 'શિક્ષણ', 'પરીક્ષા'],
};

function detectTopic(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const [topic, words] of Object.entries(TOPIC_KEYWORDS)) {
    if (words.some((w) => lower.includes(w.toLowerCase()))) return topic;
  }
  return null;
}

// Build prior-conversation context limited to the same topic. Returns "" when
// nothing relevant is found so the prompt stays compact for first-time topics.
function buildTopicHistoryBlock(history, topic, currentUserMsg, maxPairs = 3) {
  if (!topic || !history?.length) return '';
  const pairs = [];
  for (let i = 0; i < history.length - 1; i++) {
    const q = history[i];
    const a = history[i + 1];
    if (q.role !== 'user' || a.role !== 'assistant') continue;
    if (q.content === currentUserMsg) continue;
    if (detectTopic(q.content) === topic) pairs.push({ q: q.content, a: a.content });
  }
  if (!pairs.length) return '';
  const recent = pairs.slice(-maxPairs);
  const lines = recent
    .map(({ q, a }, i) => `Earlier Q${i + 1}: ${q}\nEarlier A${i + 1}: ${a}`)
    .join('\n\n');
  return `\n\n=== PRIOR CONVERSATION ON "${topic.toUpperCase()}" ===\n${lines}\n\nThe user is revisiting this topic. Build on what you already told them — don't repeat the same points verbatim, add new angles, reference the earlier answer naturally ("as I mentioned before…"), and stay consistent with it.`;
}

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
  // We include context (last 2 messages) so the guard understands follow-ups like "why?"
  const guardContext = messages.slice(-2).map(m => `${m.role}: ${m.content}`).join('\n');
  const guardRes = await callGemini(GUARD_SYSTEM, guardContext);

  let result;
  if (guardRes.trim().toUpperCase() === 'BLOCK') {
    result = "I can only guide you on what your own birth chart reveals about your life. This particular question falls outside that scope, but I'm happy to help with anything regarding your career, marriage, or personal growth! 🔮";
  } else {
    // Pull persisted history so a revisited topic can be answered with
    // awareness of what was already said — even across sessions where the
    // client `messages` array starts fresh.
    const priorHistory = form?.name && form.date && form.time && form.city
      ? await getChatHistory(form).catch(() => [])
      : [];
    const topic = detectTopic(lastMsg);
    const topicBlock = buildTopicHistoryBlock(priorHistory, topic, lastMsg);

    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const systemWithChart = `${CHAT_SYSTEM}\n\n=== THIS PERSON'S BIRTH CHART ===\n${factSheet || '(chart not provided)'}\n\nTODAY'S DATE: ${today}.${topicBlock}`;
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
