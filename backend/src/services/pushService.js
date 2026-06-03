// Push token lifecycle + the Phase-1 notification campaigns (Daily +
// Re-engagement). Astrology-driven triggers (transits / Dasha / eclipse) are
// deferred — they need server-side chart math the backend doesn't have yet.

import { Op } from 'sequelize';
import { PushToken, AuthAccount } from '../models/index.js';
import { sendToTokens } from './notificationService.js';
import { logger } from '../config/logger.js';

const log = logger.child({ mod: 'push' });

// ── Token lifecycle ──────────────────────────────────────────────────────────

// Idempotent register: one token is globally unique, so re-registering the same
// device just re-points it at the current account and re-enables it.
export async function registerToken(accountId, token, platform) {
  const [row, created] = await PushToken.findOrCreate({
    where: { token },
    defaults: { accountId, token, platform, enabled: true, lastSeenAt: new Date() },
  });
  if (!created) {
    await row.update({ accountId, platform, enabled: true, lastSeenAt: new Date() });
  }
  return row;
}

// Soft-disable on logout — keeps the row so re-login re-enables without churn.
export async function unregisterToken(accountId, token) {
  await PushToken.update(
    { enabled: false },
    { where: { token, accountId } },
  );
}

// ── Audiences ────────────────────────────────────────────────────────────────

function allEnabledTokens() {
  return PushToken.findAll({ where: { enabled: true }, attributes: ['id', 'token'] });
}

// Tokens for every device of the account(s) on a given phone. Push tokens hang
// off AuthAccount, while charts hang off User — phone is the bridge between them.
// Matched on the last 10 digits so "+919876543210" (real Firebase) and
// "9876543210" (dummy login) resolve to the same account.
async function tokensForPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) {
    log.warn({ phone }, 'tokensForPhone: no usable 10-digit phone');
    return [];
  }
  const accounts = await AuthAccount.findAll({
    where: { phone: { [Op.like]: `%${digits}` } },
    attributes: ['id'],
  });
  if (!accounts.length) {
    log.info({ digits }, 'tokensForPhone: no account for phone');
    return [];
  }
  const rows = await PushToken.findAll({
    where: { enabled: true, accountId: { [Op.in]: accounts.map((a) => a.id) } },
    attributes: ['id', 'token'],
  });
  log.info({ digits, accounts: accounts.length, tokens: rows.length }, 'tokensForPhone resolved');
  return rows;
}

// Tokens for accounts whose last login is older than `days` (and never null).
async function inactiveAccountTokens(days) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const accounts = await AuthAccount.findAll({
    where: { lastLoginAt: { [Op.lt]: cutoff } },
    attributes: ['id'],
  });
  if (!accounts.length) return [];
  return PushToken.findAll({
    where: { enabled: true, accountId: { [Op.in]: accounts.map((a) => a.id) } },
    attributes: ['id', 'token'],
  });
}

// ── Campaigns (called by the cron controller) ───────────────────────────────

const COPY = {
  morning: {
    title: '🌅 Good Morning!',
    body: "Check your personalized daily horoscope and today's auspicious timings (Muhurat).",
    data: { type: 'daily', target: 'today' },
  },
  evening: {
    title: '🌙 Evening Reflection',
    body: 'Reflect on your day — see what the stars have planned for you tomorrow.',
    data: { type: 'daily', target: 'tomorrow' },
  },
  inactivity: {
    title: '✨ The stars have a message for you',
    body: 'Ask our AI Astrologer a question today.',
    data: { type: 'reengage', screen: 'chat' },
  },
};

export async function sendDailyMorning() {
  return sendToTokens(await allEnabledTokens(), COPY.morning);
}

export async function sendDailyEvening() {
  return sendToTokens(await allEnabledTokens(), COPY.evening);
}

// Re-engagement: users idle for 3+ days. (The "incomplete palm" nudge needs a
// per-reading viewedAt flag — added in the mobile phase — so it's not wired yet.)
export async function sendReEngagement() {
  const rows = await inactiveAccountTokens(3);
  log.info({ audience: rows.length }, 're-engagement audience');
  return sendToTokens(rows, COPY.inactivity);
}

// ── Event-triggered (fired inline from feature services) ─────────────────────

// "Welcome — your first chat is free." Onboarding nudge fired exactly once,
// when a user first adds their birth data (i.e. a brand-new User row is
// created). Pushes them toward the chat CTA. Best-effort, never blocks.
export async function notifyWelcome(phone) {
  const rows = await tokensForPhone(phone);
  if (!rows.length) return { sent: 0, failed: 0, disabled: 0 };
  return sendToTokens(rows, {
    title: '🔮 Welcome to Astrology AI!',
    body: 'Your first chat is FREE! Got questions about your life, marriage, or career? Just ask away!',
    data: { type: 'welcome', screen: 'chat' },
  });
}

// Admin-composed push to a single user's devices (resolved by phone, same
// account-bridge as the campaigns). Returns the FCM fan-out summary so the
// back-office can show delivery results.
export async function sendCustomToPhone(phone, { title, body }) {
  const rows = await tokensForPhone(phone);
  if (!rows.length) return { sent: 0, failed: 0, disabled: 0 };
  return sendToTokens(rows, { title, body, data: { type: 'admin' } });
}

// "Your Kundali insight is ready." Fired after a fresh interpretation is
// generated + persisted. Best-effort: the caller must not await or let a push
// failure affect the HTTP response.
export async function notifyInsightReady(phone) {
  const rows = await tokensForPhone(phone);
  if (!rows.length) return { sent: 0, failed: 0, disabled: 0 };
  return sendToTokens(rows, {
    title: '✨ Your Insight Data is Ready!',
    body: 'You can read it now — tap to open your reading.',
    data: { type: 'insight', screen: 'reading' },
  });
}
