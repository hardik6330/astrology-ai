// Engagement notifications: poetic English hooks sent at RANDOMISED times to a
// configurable audience (all / one random user / random sample). Designed for
// serverless (Vercel): an external cron polls /api/cron/run?job=engage on a
// fixed cadence, and ALL scheduling state lives in the DB (the `notif_next_at`
// setting) — never in process memory. Each tick:
//   1. gate on enabled + the IST waking window,
//   2. atomically CLAIM the slot (so two overlapping cron hits can't double-send),
//   3. pick content (curated pool LRU, or a fresh Flash-generated line),
//   4. fan out via the existing FCM sender, capped so it never trips the timeout.

import { PushToken, Setting, NotificationTemplate } from '../models/index.js';
import { sendToTokens } from './notificationService.js';
import * as settings from './settingsService.js';
import { callGemini } from '../ai/gemini.js';
import { FLASH_MODELS } from '../config/constants.js';
import { SHAYARI_SYSTEM } from '../ai/prompts.js';
import { logger } from '../config/logger.js';

const log = logger.child({ mod: 'engage' });

const IST_OFFSET_MIN = 330; // India is UTC+5:30, no DST.

// IST wall-clock parts for an epoch-ms instant.
function istParts(ms) {
  const d = new Date(ms + IST_OFFSET_MIN * 60000);
  return { y: d.getUTCFullYear(), mo: d.getUTCMonth(), da: d.getUTCDate(), h: d.getUTCHours() };
}
// Epoch ms for a given IST wall-clock time (Date.UTC normalises day overflow).
function istToUtcMs(y, mo, da, h, mi) {
  return Date.UTC(y, mo, da, h, mi) - IST_OFFSET_MIN * 60000;
}

// Next send instant: a random gap from now, clamped back into the IST window.
function computeNextAt(now, { minGap, maxGap, winStart, winEnd }) {
  const gapH = minGap + Math.random() * Math.max(0, maxGap - minGap);
  let cand = now + gapH * 3600000;
  const p = istParts(cand);
  const rndMin = Math.floor(Math.random() * 60);
  if (p.h < winStart) cand = istToUtcMs(p.y, p.mo, p.da, winStart, rndMin);
  else if (p.h >= winEnd) cand = istToUtcMs(p.y, p.mo, p.da + 1, winStart, rndMin); // tomorrow
  return Math.round(cand);
}

// ── Content ──────────────────────────────────────────────────────────────────

const THEMES = ['love', 'money', 'career', 'regret', 'hope', 'dasha', 'night-mood'];
const EMOTIONS = ['teasing', 'comforting', 'mysterious', 'playful'];
const PLANETS = ['Saturn', 'Mars', 'Venus', 'Jupiter', 'Mercury', 'the Moon', 'the Sun', 'Rahu', 'Ketu'];
const TIMES = ['morning', 'evening', 'night'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function randomSeed() {
  return { theme: pick(THEMES), emotion: pick(EMOTIONS), planet: pick(PLANETS), timeOfDay: pick(TIMES) };
}

// One fresh English hook via Flash (thinking off → cheapest). Throws on a bad
// or empty generation so callers can fall back to the curated pool.
export async function generateShayari(seed = randomSeed()) {
  const userPrompt =
    `Write one notification.\n` +
    `Theme: ${seed.theme}\nEmotion: ${seed.emotion}\n` +
    `Planet to reference naturally: ${seed.planet}\nTime of day: ${seed.timeOfDay}`;
  const raw = await callGemini(SHAYARI_SYSTEM, userPrompt, true, FLASH_MODELS, 0);
  const obj = JSON.parse(raw.replace(/```json|```/g, '').trim());
  const title = String(obj.title || '').slice(0, 120).trim();
  const body = String(obj.body || '').slice(0, 500).trim();
  if (!title || !body) throw new Error('empty generation');
  return { title, body, screen: 'reading' };
}

// Draft N AI lines into the pool as DISABLED rows for admin approval. Handy for
// "Generate 10 new shayari" without putting unreviewed text live.
export async function generateDrafts(count = 5) {
  const drafts = [];
  for (let i = 0; i < count; i++) {
    try {
      const { title, body, screen } = await generateShayari();
      drafts.push({ title, body, screen, category: 'ai', source: 'ai', enabled: false });
    } catch (err) {
      log.warn({ err: err.message }, 'draft generation failed');
    }
  }
  if (drafts.length) await NotificationTemplate.bulkCreate(drafts);
  return { drafted: drafts.length };
}

// Least-recently-used random pick from the enabled pool, so the same line isn't
// repeated back-to-back.
async function pickTemplate() {
  const rows = await NotificationTemplate.findAll({ where: { enabled: true } });
  if (!rows.length) return null;
  rows.sort((a, b) =>
    (a.lastSentAt ? +new Date(a.lastSentAt) : 0) - (b.lastSentAt ? +new Date(b.lastSentAt) : 0));
  const half = rows.slice(0, Math.max(1, Math.ceil(rows.length / 2)));
  return half[Math.floor(Math.random() * half.length)];
}

// ── Audience ─────────────────────────────────────────────────────────────────

async function resolveAudience(mode) {
  if (mode === 'random_one') {
    const all = await PushToken.findAll({ where: { enabled: true }, attributes: ['id', 'token', 'accountId'] });
    if (!all.length) return [];
    const ids = [...new Set(all.map((r) => r.accountId))];
    const acc = pick(ids);
    return all.filter((r) => r.accountId === acc);
  }
  // 'all' (default) — every enabled device. notificationService fans out in
  // batches of 500 (FCM's per-call max), so there's no recipient ceiling here.
  return PushToken.findAll({ where: { enabled: true }, attributes: ['id', 'token'] });
}

// ── Entry point (called by the cron controller) ─────────────────────────────

// `force` skips the window + due-check + atomic claim — used by the manual
// `engage_now` job for testing / admin "send test now".
export async function sendEngagement({ force = false } = {}) {
  if ((await settings.get('notif_enabled')) !== 'true' && !force) {
    return { skipped: 'disabled' };
  }

  const winStart = await settings.getNumber('notif_window_start', 9);
  const winEnd = await settings.getNumber('notif_window_end', 21);
  const minGap = await settings.getNumber('notif_min_gap_hours', 5);
  const maxGap = await settings.getNumber('notif_max_gap_hours', 12);
  const mode = (await settings.get('notif_audience')) || 'all';
  const source = (await settings.get('notif_source')) || 'pool';

  const now = Date.now();

  if (!force) {
    // 1. Waking-window gate (IST).
    const h = istParts(now).h;
    if (h < winStart || h >= winEnd) return { skipped: 'outside_window', hourIST: h };

    // 2. Due-check + ATOMIC claim. notif_next_at is read fresh (not the cached
    //    settingsService) and the UPDATE is guarded on its current value, so
    //    only one of two overlapping cron hits wins the slot.
    const row = await Setting.findByPk('notif_next_at');
    const curVal = row?.value ?? '0';
    if (now < Number(curVal)) {
      return { skipped: 'not_due', nextAt: new Date(Number(curVal)).toISOString() };
    }
    const newVal = String(computeNextAt(now, { minGap, maxGap, winStart, winEnd }));
    const [affected] = await Setting.update(
      { value: newVal },
      { where: { key: 'notif_next_at', value: curVal } },
    );
    if (affected === 0) return { skipped: 'claimed_by_other' };
    settings.invalidate();
  }

  // 3. Content: fresh Flash line if configured, else the curated pool.
  let title, body, screen = 'reading', usedSource = 'pool', templateId = null;
  if (source === 'ai') {
    try { ({ title, body, screen } = await generateShayari()); usedSource = 'ai'; }
    catch (err) { log.warn({ err: err.message }, 'AI generate failed — falling back to pool'); }
  }
  if (!title) {
    const t = await pickTemplate();
    if (!t) return { skipped: 'no_templates' };
    ({ title, body, screen } = { title: t.title, body: t.body, screen: t.screen || 'reading' });
    templateId = t.id;
    await t.update({ lastSentAt: new Date() });
  }

  // 4. Audience + fan-out.
  const rows = await resolveAudience(mode);
  if (!rows.length) return { skipped: 'no_audience', mode };

  // 6h TTL: a "vibe" push is tied to the moment it's chosen — if undeliverable
  // now, drop it rather than have FCM replay it hours later on reconnect.
  const result = await sendToTokens(rows, { title, body, data: { type: 'engage', screen }, ttlMs: 6 * 60 * 60 * 1000 });
  log.info({ mode, audience: rows.length, source: usedSource, ...result }, 'engagement sent');
  return { ...result, audience: rows.length, mode, source: usedSource, templateId, title };
}
