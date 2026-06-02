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
