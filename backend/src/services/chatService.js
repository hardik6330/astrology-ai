import { ChatMessage, PalmReading } from '../models/index.js';
import { callGemini } from '../ai/gemini.js';
import { CHAT_SYSTEM, GUARD_SYSTEM } from '../ai/prompts.js';
import { CHAT_ANSWER_MODELS, THINK_BUDGET } from '../config/constants.js';
import { findOrCreateUser, findUserByForm } from './userService.js';
import { charge, grant } from './creditService.js';
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

// Pull the user's most recent palm reading and render it as a compact block
// for the chat system prompt. Returns "" if no usable reading exists so the
// prompt stays clean for users who haven't done a palm scan yet.
async function buildPalmBlock(userId) {
  if (!userId) return '';
  const palm = await PalmReading.findOne({
    where: { userId },
    order: [['createdAt', 'DESC']],
  }).catch(() => null);
  if (!palm) return '';
  const r = typeof palm.reading === 'string' ? JSON.parse(palm.reading) : palm.reading;
  if (!r || r.imageQuality === 'unusable') return '';

  // Both-hands reading: prefer the comparison synthesis. Single-hand falls
  // back to overallVibe + the four major lines.
  if (r.left && r.right && r.comparison) {
    const c = r.comparison;
    return `\n\n=== WHAT THIS PERSON'S HANDS SHOWED (recent palm reading) ===
Inborn nature (left): ${r.left.overallVibe || ''}
Lived reality (right): ${r.right.overallVibe || ''}
Evolution: ${c.evolution || ''}
Alignment: ${c.alignment || ''}. Grown stronger: ${(c.grownStronger||[]).join('; ')||'—'}. Watch points: ${(c.watchPoints||[]).join('; ')||'—'}
Use this as supporting context when emotional, character, or growth questions come up — never invent palm features.`;
  }
  const sections = [
    r.overallVibe && `Overall: ${r.overallVibe}`,
    r.lifeLine    && `Life line: ${r.lifeLine}`,
    r.headLine    && `Head line: ${r.headLine}`,
    r.heartLine   && `Heart line: ${r.heartLine}`,
    r.fateLine    && `Fate line: ${r.fateLine}`,
  ].filter(Boolean);
  if (!sections.length) return '';
  return `\n\n=== WHAT THIS PERSON'S HANDS SHOWED (recent palm reading) ===\n${sections.join('\n')}\nUse this as supporting context when emotional, character, or growth questions come up — never invent palm features.`;
}

// GET chat history for a user — used to restore the conversation on refresh.
export async function getChatHistory(form) {
  const user = await findUserByForm(form);
  if (!user) return [];
  const rows = await ChatMessage.findAll({
    where: { userId: user.id },
    // Secondary 'role' DESC tiebreak orders 'user' before 'assistant' within
    // the same second — fixes legacy pairs saved with identical timestamps.
    order: [['createdAt', 'ASC'], ['role', 'DESC']],
    attributes: ['role', 'content'],
  });
  return rows.map((r) => ({ role: r.role, content: r.content }));
}

// Answer one user turn against the chart, then persist the exchange.
export async function answerAndPersist({ messages, factSheet, form }) {
  const lastMsg = messages[messages.length - 1].content;
  const hasForm = form?.name && form.date && form.time && form.city;

  // Resolve the user up-front (chat needs a chart, so a form is expected) and
  // charge per message BEFORE doing any AI work — so an out-of-credits user is
  // rejected without spending tokens. Throws 402 INSUFFICIENT_CREDITS.
  const user = hasForm ? await findOrCreateUser(form) : null;
  let charged = 0;
  let balance = null;
  if (user) ({ charged, balance } = await charge({ userId: user.id, costKey: 'chat_cost', reason: 'chat' }));

  let result;
  try {
    // 1. Topic guard — flags off-chart questions so we can ask Pro to REFRAME
    // them through the chart angle instead of flatly refusing.
    const guardContext = messages.slice(-2).map(m => `${m.role}: ${m.content}`).join('\n');
    const guardRes = await callGemini(GUARD_SYSTEM, guardContext);
    const isOffChart = guardRes.trim().toUpperCase() === 'BLOCK';

    // Pull persisted history so a revisited topic can be answered with
    // awareness of what was already said. Reuse the already-resolved user.
    const [priorHistory, palmBlock] = await Promise.all([
      user
        ? ChatMessage.findAll({
            where: { userId: user.id },
            order: [['createdAt', 'ASC'], ['role', 'DESC']],
            attributes: ['role', 'content'],
          }).then(rows => rows.map(r => ({ role: r.role, content: r.content }))).catch(() => [])
        : Promise.resolve([]),
      user ? buildPalmBlock(user.id) : Promise.resolve(''),
    ]);
    const topic = detectTopic(lastMsg);
    const topicBlock = buildTopicHistoryBlock(priorHistory, topic, lastMsg);

    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const reframeNote = isOffChart
      ? `\n\nNOTE: This user's question is technically outside what a birth chart can literally name (e.g. a brand, a person's name, a specific number). DO NOT refuse. Find the chart angle behind what they're really asking and answer that. One acknowledging sentence, then 2-3 sentences of useful chart-grounded insight.`
      : '';
    const systemWithChart = `${CHAT_SYSTEM}\n\n=== THIS PERSON'S BIRTH CHART ===\n${factSheet || '(chart not provided)'}${palmBlock}\n\nTODAY'S DATE: ${today}.${topicBlock}${reframeNote}`;
    result = await callGemini(systemWithChart, lastMsg, false, CHAT_ANSWER_MODELS, THINK_BUDGET.CHAT);
  } catch (e) {
    // AI failed after we charged — refund so the user isn't billed for a
    // message they never received an answer to.
    if (user && charged) {
      await grant({ userId: user.id, amount: charged, reason: 'refund', meta: { for: 'chat' } })
        .catch((err) => log.warn({ err: err.message }, 'chat refund failed'));
    }
    throw e;
  }

  // 2. Persist exchange (best-effort). Stamp the assistant reply 1s after the
  // user message so history sorts deterministically: the createdAt column is
  // only second-precision, and a same-second pair would otherwise sort by an
  // unordered random PK — letting the answer render above its own question.
  if (user) {
    try {
      const askedAt = new Date();
      const repliedAt = new Date(askedAt.getTime() + 1000);
      await ChatMessage.bulkCreate([
        { userId: user.id, role: 'user',      content: lastMsg, createdAt: askedAt,   updatedAt: askedAt },
        { userId: user.id, role: 'assistant', content: result,  createdAt: repliedAt, updatedAt: repliedAt },
      ]);
    } catch (saveError) {
      log.error({ err: saveError }, 'Chat save failed');
    }
  }

  return { content: result, balance };
}
