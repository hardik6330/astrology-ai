import { ChatMessage, PalmReading, Kundali } from '../models/index.js';
import { callGemini } from '../ai/gemini.js';
import { CHAT_SYSTEM, GUARD_SYSTEM } from '../ai/prompts.js';
import { CHAT_ANSWER_MODELS, THINK_BUDGET } from '../config/constants.js';
import { findOrCreateUser, findUserByForm } from './userService.js';
import { charge, grant } from './creditService.js';
import { fenceUntrusted, UNTRUSTED_DATA_GUARD } from '../utils/promptSafety.js';
import { logger } from '../config/logger.js';

const log = logger.child({ mod: 'chat' });

// Cap the per-user history scan. Without a bound, ChatMessage.findAll loads a
// user's ENTIRE message history every fetch — a full-table-per-user read that
// becomes a multi-second query (and a memory spike) for heavy chatters. The
// newest N messages are more than enough for both UI restore and topic context.
const MAX_CHAT_HISTORY = 200;

// Fetch a user's most-recent messages in chronological (ASC) order, bounded by
// MAX_CHAT_HISTORY. Queries newest-first (so the LIMIT keeps the latest), then
// reverses to chronological. The role tiebreak mirrors the original ASC sort
// ('user' before 'assistant' within the same second) after the reverse.
async function fetchRecentHistory(userId, limit = MAX_CHAT_HISTORY) {
  const rows = await ChatMessage.findAll({
    where: { userId },
    order: [['createdAt', 'DESC'], ['role', 'ASC']],
    limit,
    attributes: ['role', 'content'],
  });
  return rows.reverse().map((r) => ({ role: r.role, content: r.content }));
}

// Canned reply when the topic gate blocks an off-topic message (general
// knowledge, coding, other named people, NSFW). Returned WITHOUT the expensive
// answer call — the guard is lenient, so genuine life/astrology/personal and
// sensitive questions are never blocked.
const OFF_TOPIC_REPLY =
  "I can only speak to what your birth chart can — your life, work, relationships, health, money, timing, and inner path. Ask me about any of those and I'll read it from your chart.";

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
    where: { userId, imageQuality: 'clear' },
    order: [['createdAt', 'DESC']],
  }).catch(() => null);
  if (!palm) return '';
  const r = typeof palm.reading === 'string' ? JSON.parse(palm.reading) : palm.reading;
  if (!r) return '';

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

// Pull the user's already-unlocked master reading (insight) and render a
// compact block so chat answers stay consistent with what they've already
// read. Returns "" when the user hasn't unlocked an insight yet, so the prompt
// stays clean (chart-only) for those users.
async function buildInsightBlock(userId) {
  if (!userId) return '';
  const kundali = await Kundali.findOne({ where: { userId } }).catch(() => null);
  if (!kundali) return '';
  let r = kundali.interpretation;
  try {
    r = typeof r === 'string' ? JSON.parse(r) : r;
  } catch {
    return '';
  }
  if (!r || typeof r !== 'object') return '';
  const sections = [
    r.lifeTheme     && `Core theme: ${r.lifeTheme}`,
    r.personality   && `Personality: ${r.personality}`,
    r.career        && `Career & purpose: ${r.career}`,
    r.relationships && `Relationships: ${r.relationships}`,
  ].filter(Boolean);
  if (!sections.length) return '';
  return `\n\n=== THIS PERSON'S UNLOCKED READING (already shown to them) ===\n${sections.join('\n')}\nStay consistent with this reading; never contradict it or invent new placements.`;
}

// GET chat history for a user — used to restore the conversation on refresh.
export async function getChatHistory(form) {
  const user = await findUserByForm(form);
  if (!user) return [];
  return fetchRecentHistory(user.id);
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

  // Refund the charge — used on an off-topic block and on an AI error, so the
  // user is never billed for a message they got no real answer to.
  const refund = async (why) => {
    if (!user || !charged) return;
    const r = await grant({ userId: user.id, amount: charged, reason: 'refund', meta: { for: 'chat', why } })
      .catch((err) => { log.warn({ err: err.message }, 'chat refund failed'); return null; });
    if (r) balance = r.balance;
  };

  let result;
  try {
    // 1. Topic gate — ENFORCED. Off-topic messages (general knowledge, coding,
    // other named people, NSFW) are refused HERE, without the expensive Pro
    // answer call. The guard is deliberately lenient (greetings, personal-data,
    // and sensitive mortality/illness questions all ALLOW — see GUARD_SYSTEM),
    // so only genuinely off-topic questions are blocked. Fence the message so an
    // injection can't coerce the classifier into "ALLOW".
    const guardContext = messages.slice(-2).map(m => `${m.role}: ${m.content}`).join('\n');
    const guardRes = await callGemini(GUARD_SYSTEM, fenceUntrusted(guardContext));
    if (guardRes.trim().toUpperCase().startsWith('BLOCK')) {
      await refund('off_topic');
      log.info({ userId: user?.id }, 'chat blocked: off-topic');
      return { content: OFF_TOPIC_REPLY, balance, blocked: true };
    }

    // Pull persisted history so a revisited topic can be answered with
    // awareness of what was already said. Reuse the already-resolved user.
    const [priorHistory, palmBlock, insightBlock] = await Promise.all([
      user ? fetchRecentHistory(user.id).catch(() => []) : Promise.resolve([]),
      user ? buildPalmBlock(user.id) : Promise.resolve(''),
      user ? buildInsightBlock(user.id) : Promise.resolve(''),
    ]);
    const topic = detectTopic(lastMsg);
    const topicBlock = buildTopicHistoryBlock(priorHistory, topic, lastMsg);

    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    // The fact sheet is client-supplied free text — fence it so it can't act as
    // instructions inside the system prompt (see promptSafety). CHAT_SYSTEM
    // already reframes questions the chart can't literally name (brand, number),
    // so no separate reframe note is needed now that off-topic is blocked above.
    const systemWithChart = `${CHAT_SYSTEM}${UNTRUSTED_DATA_GUARD}\n\n=== THIS PERSON'S BIRTH CHART ===\n${fenceUntrusted(factSheet || '(chart not provided)')}${insightBlock}${palmBlock}\n\nTODAY'S DATE: ${today}.${topicBlock}`;
    result = await callGemini(systemWithChart, lastMsg, false, CHAT_ANSWER_MODELS, THINK_BUDGET.CHAT);
  } catch (e) {
    // AI failed after we charged — refund so the user isn't billed for a
    // message they never received an answer to.
    await refund('error');
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
