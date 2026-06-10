import crypto from 'node:crypto';
import { PalmReading, PalmEmbedding } from '../models/index.js';
import { callGeminiVision, callGeminiVisionMulti } from '../ai/gemini.js';
import { PALM_SYSTEM, PALM_GATE_SYSTEM, PALM_BOTH_HANDS_SYSTEM } from '../ai/prompts.js';
import { dedupe } from '../ai/dedupe.js';
import { findOrCreateUser, findUserByForm } from './userService.js';
import { charge, grant, getBalance } from './creditService.js';
import * as settings from './settingsService.js';
import { notifyInsightReady } from './pushService.js';
import { validateImage } from '../utils/imageValidator.js';
import { landmarkEmbedding, cosineSim } from '../utils/palmEmbedding.js';
import { asContent } from '../utils/asContent.js';
import { cleanJson } from '../utils/cleanJson.js';
import { userKey } from '../utils/userKey.js';
import { PALM_MODELS, PALM_GATE_MODELS, THINK_BUDGET } from '../config/constants.js';
import { AppError } from '../errors/AppError.js';
import { logger } from '../config/logger.js';

const log = logger.child({ mod: 'palm' });

// GET the latest saved palm reading.
export async function getSavedPalm(form) {
  const user = await findUserByForm(form);
  if (!user) return null;
  const palm = await PalmReading.findOne({
    where: { userId: user.id },
    order: [['createdAt', 'DESC']],
  });
  if (!palm) return null;
  return { id: palm.id, content: asContent(palm.reading) };
}

// GET list of past palm readings (lightweight — no full reading body).
export async function getPalmHistory(form) {
  const user = await findUserByForm(form);
  if (!user) return [];
  return PalmReading.findAll({
    where: { userId: user.id },
    order: [['createdAt', 'DESC']],
    attributes: ['id', 'handType', 'imageQuality', 'createdAt'],
  });
}

// GET a specific past palm reading by id (scoped to the user).
export async function getPalmById(id, form) {
  const user = await findUserByForm(form);
  if (!user) return null;
  const palm = await PalmReading.findOne({ where: { id, userId: user.id } });
  if (!palm) return null;
  return { id: palm.id, content: asContent(palm.reading) };
}

// POST — validate image, dedupe by hash, call Gemini Vision, persist reading
// (NEVER the image bytes), return the raw model output.
// Run the Flash gate only — exported so comparePalms can verify BOTH hands
// cheaply before spending Pro tokens on either. Returns:
//   { ok: true,  base64, mimeType, imageHash }   when the photo is usable
//   { ok: false, rejection, base64, mimeType, imageHash }  otherwise
// If `skipGate` is true, the Flash call is bypassed and the photo is
// declared usable (used when the client already gated locally via
// MediaPipe — the web flow does this).
async function runGate({ image, claimedHand, skipGate = false, scanId }) {
  const t = Date.now();
  let mimeType, base64;
  try {
    ({ mime: mimeType, base64 } = validateImage(image));
  } catch (e) {
    throw AppError.http(400, e.message, 'INVALID_IMAGE');
  }
  const imageHash = crypto.createHash('sha256').update(base64).digest('hex');
  const kb = Math.round((base64.length * 0.75) / 1024);

  // Web has already gated this photo locally with MediaPipe — skip the
  // duplicate Flash call to save the token.
  if (skipGate) {
    log.info({ scanId, stage: 'gate', skipGate: true, kb, hash: imageHash.slice(0, 8), ms: Date.now() - t }, 'palm scan: gate skipped (client-gated)');
    return { ok: true, base64, mimeType, imageHash };
  }

  // We used to pass the claimed hand here, but Flash isn't reliable at
  // distinguishing left vs right (phone cameras mirror inconsistently).
  // We now trust the user's claim and use Flash only for image quality.
  const gateUser = 'Is this a clear, usable photo of a single open human palm?';

  let gateParsed = null;
  try {
    const gateRaw = await callGeminiVision(
      PALM_GATE_SYSTEM, gateUser, base64, mimeType,
      true, PALM_GATE_MODELS, THINK_BUDGET.PALM_GATE
    );
    gateParsed = JSON.parse(cleanJson(gateRaw));
  } catch (e) {
    log.warn({ err: e.message }, 'Palm gate skipped — proceeding with Pro');
  }

  if (gateParsed?.imageQuality === 'unusable') {
    log.info({ scanId, stage: 'gate', skipGate: false, kb, ok: false, reject: gateParsed.rejectReason, ms: Date.now() - t }, 'palm scan: gate REJECTED');
    return {
      ok: false,
      base64, mimeType, imageHash,
      rejection: {
        handType: 'Unclear',
        imageQuality: 'unusable',
        rejectReason: gateParsed.rejectReason || 'not_a_palm',
        retakeReason: gateParsed.retakeReason || 'Please retake with a clearer palm photo.',
      },
    };
  }
  log.info({ scanId, stage: 'gate', skipGate: false, kb, ok: true, ms: Date.now() - t }, 'palm scan: gate passed (Flash)');
  return { ok: true, base64, mimeType, imageHash };
}

// 1:N biometric search — find the most-similar saved palm of the SAME hand
// type, across ALL users, whose similarity clears the threshold. Loads every
// embedding for that hand into memory (fine at our scale; swap for a vector
// index if PalmEmbedding ever grows large). Returns { userId, palmReadingId,
// sim } or null. EXPERIMENTAL — see utils/palmEmbedding.js for the caveats.
async function findBiometricMatch({ handType, embedding, threshold, scanId }) {
  const t = Date.now();
  // The reading is denormalized onto the embedding row, so the match is
  // self-contained — no JOIN, and it survives the source PalmReading being
  // deleted. We carry the matched row's `reading` straight through.
  const rows = await PalmEmbedding.findAll({
    where: { handType },
    attributes: ['userId', 'palmReadingId', 'embedding', 'reading'],
  });
  let best = null;
  for (const r of rows) {
    if (!r.reading) continue; // legacy rows without denormalized reading — skip
    const sim = cosineSim(embedding, r.embedding);
    if (!best || sim > best.sim) {
      best = { userId: r.userId, palmReadingId: r.palmReadingId, sim, reading: r.reading };
    }
  }
  // Always log the top score so the threshold can be tuned against real photos.
  // `matched` shows whether this scan would reuse a saved reading.
  log.info(
    { scanId, stage: 'match', handType, candidates: rows.length, topSim: best ? Number(best.sim.toFixed(4)) : null, threshold, matched: !!best && best.sim >= threshold, ms: Date.now() - t },
    'palm scan: biometric search',
  );
  return best && best.sim >= threshold ? best : null;
}

// Persist a reading row for this user and (for clear readings) its embedding,
// so future photos of the same hand can match it. Best-effort — logs, doesn't throw.
async function persistReadingWithEmbedding({ user, parsed, imageHash, embedding }) {
  try {
    const row = await PalmReading.create({
      userId: user.id,
      handType: parsed.handType,
      imageQuality: parsed.imageQuality,
      imageHash,
      reading: parsed,
    });
    if (embedding && parsed.imageQuality === 'clear') {
      await PalmEmbedding.create({
        userId: user.id, palmReadingId: row.id, handType: parsed.handType, embedding,
        reading: parsed, // denormalized so the match survives the reading being deleted
      }).catch((e) => log.warn({ err: e.message }, 'Palm embedding save failed'));
    }
    return row.id;
  } catch (saveError) {
    log.error({ err: saveError }, 'Palm save failed');
    return null;
  }
}

// Run Pro + persistence. Assumes the gate has already passed.
async function runProAndPersist({ form, claimedHand, base64, mimeType, imageHash, scanId, landmarks }) {
  const t0 = Date.now();
  const user = await findOrCreateUser(form);

  // Push "your insight is ready" to this user's registered devices. Fired only
  // when the reading is NEWLY produced for them — not on plain cache hits.
  const fireInsightPush = () =>
    notifyInsightReady(user.phone || form.phone)
      .catch((err) => log.warn({ err: err.message }, 'palm-insight-ready push failed'));

  // Same image already analyzed (e.g. user retries same photo)? Only
  // dedupe SUCCESSFUL readings — never short-circuit on a cached
  // "unusable" row, otherwise a one-time rejection (gate misfire,
  // bad-lighting attempt, etc.) gets sticky and the user can never retry
  // the same photo.
  const dup = await PalmReading.findOne({
    where: { userId: user.id, imageHash, imageQuality: 'clear' },
  });
  if (dup) {
    log.info({ scanId, path: 'cache-hit', reason: 'same image, same user', totalMs: Date.now() - t0 }, 'palm scan: complete (free re-view)');
    return { content: asContent(dup.reading), balance: await getBalance(user.id) };
  }

  // EXPERIMENTAL biometric match: a NEW photo of a hand we've already read
  // (this user OR another user/device) reuses that reading instead of calling
  // Gemini. Uses LANDMARK GEOMETRY (the 21 MediaPipe points the client sends) —
  // pose/scale-invariant, so different photos of the same hand can match.
  // Requires landmarks + a known hand. Failure here is non-fatal — fall through
  // to a normal fresh analysis.
  let embedding = null;
  const handType = claimedHand || null;
  const matchEnabled = (await settings.get('palm_match_enabled')) === 'true';
  if (matchEnabled && handType && Array.isArray(landmarks)) {
    try {
      const tEmb = Date.now();
      embedding = landmarkEmbedding(landmarks);
      if (!embedding) throw new Error('landmark embedding unavailable');
      log.info({ scanId, stage: 'embedding', dim: embedding.length, ms: Date.now() - tEmb }, 'palm scan: landmark embedding computed');
      const threshold = await settings.getNumber('palm_match_threshold', 0.92);
      const match = await findBiometricMatch({ handType, embedding, threshold, scanId });
      if (match) {
        // match.reading is denormalized on the embedding row. It can come back
        // from MySQL JSON as a string — parse before spreading, else
        // { ...string } explodes into char-indexed keys (blank card).
        const baseReading = typeof match.reading === 'string'
          ? JSON.parse(match.reading) : match.reading;
        if (baseReading && baseReading.imageQuality === 'clear') {
          // Same user re-scanning their own hand → free re-view. A DIFFERENT
          // user (new number/device) → charge like a fresh reading (matches the
          // kundali sibling-copy policy; just skips the Gemini call). 402 if short.
          let balance;
          if (match.userId === user.id) {
            balance = await getBalance(user.id);
          } else {
            ({ balance } = await charge({ userId: user.id, costKey: 'palm_cost', reason: 'palm', meta: { matched: true } }));
          }
          const parsed = { ...baseReading, handType };
          await persistReadingWithEmbedding({ user, parsed, imageHash, embedding });
          log.info(
            { scanId, path: 'biometric-match', matchedFrom: match.userId, sameUser: match.userId === user.id, sim: Number(match.sim.toFixed(4)), charged: match.userId !== user.id, totalMs: Date.now() - t0 },
            'palm scan: complete (reused — no AI call)',
          );
          fireInsightPush();
          return { content: asContent(parsed), balance };
        }
      }
    } catch (e) {
      log.warn({ err: e.message }, 'Palm embedding/match failed — fresh analysis');
    }
  }

  // Fresh analysis → charge once (dups/matches above are free or already
  // charged). Throws 402 INSUFFICIENT_CREDITS if the balance is short.
  const { charged, balance } = await charge({ userId: user.id, costKey: 'palm_cost', reason: 'palm' });

  let parsed;
  const tAI = Date.now();
  try {
    const userPrompt = `NAME: ${form.name}\nGENDER: ${form.gender || 'NOT SPECIFIED'}\n\nAnalyze this palm photograph.`;
    log.info({ scanId, stage: 'ai', models: PALM_MODELS }, 'palm scan: calling Gemini vision…');
    const raw = await callGeminiVision(PALM_SYSTEM, userPrompt, base64, mimeType, true, PALM_MODELS, THINK_BUDGET.PALM);
    const cleaned = cleanJson(raw);
    parsed = typeof raw === 'string' ? JSON.parse(cleaned) : raw;
    log.info({ scanId, stage: 'ai', quality: parsed.imageQuality, hand: parsed.handType, ms: Date.now() - tAI }, 'palm scan: Gemini reading done');
  } catch (e) {
    log.error({ scanId, err: e.message, ms: Date.now() - tAI }, 'palm scan: Gemini/parse failed');
    parsed = { handType: 'Unclear', imageQuality: 'unusable', retakeReason: 'Could not parse reading. Please try again.' };
  }

  if (claimedHand && parsed.imageQuality !== 'unusable') {
    parsed.handType = claimedHand;
  }

  // Unusable result → refund: the user shouldn't pay for a reading they can't use.
  let finalBalance = balance;
  if (parsed.imageQuality === 'unusable' && charged) {
    const refund = await grant({ userId: user.id, amount: charged, reason: 'refund', meta: { for: 'palm' } })
      .catch((err) => { log.warn({ err: err.message }, 'palm refund failed'); return null; });
    if (refund) finalBalance = refund.balance;
  }

  // Persist the reading + (for clear readings) its embedding so future photos
  // of this hand match. Newly persisted clear reading → notify the user.
  await persistReadingWithEmbedding({ user, parsed, imageHash, embedding });
  if (parsed.imageQuality !== 'unusable') fireInsightPush();

  log.info(
    { scanId, path: 'fresh-ai', quality: parsed.imageQuality, refunded: parsed.imageQuality === 'unusable' && !!charged, totalMs: Date.now() - t0 },
    'palm scan: complete (fresh reading)',
  );
  return { content: JSON.stringify(parsed), balance: finalBalance };
}

// Gate rejections are NO LONGER persisted. They're cheap to re-compute and
// caching them makes retries impossible (a one-off bad-lighting attempt
// becomes permanent). Pro readings are still persisted in runProAndPersist.
async function persistGateRejection(_form, _imageHash, _rejection) {
  /* intentionally a no-op — see comment above */
}

export async function analyzePalm({ image, form, claimedHand, skipGate, landmarks }) {
  // Short id to correlate every log line of one scan. Grep `scanId=xxxxxxxx`.
  const scanId = crypto.randomBytes(4).toString('hex');
  log.info({ scanId, hand: claimedHand || null, skipGate: !!skipGate, landmarks: Array.isArray(landmarks) ? landmarks.length : 0 }, 'palm scan: received');

  // Stage 1 — gate. We need the image hash to build the dedupe key, so the
  // gate runs before dedupe. The Flash call is cheap and we'd hit cache for
  // truly identical retries via the per-image PalmReading row inside Pro.
  const gateResult = await runGate({ image, claimedHand, skipGate, scanId });

  return dedupe(`palm|${userKey(form)}|${gateResult.imageHash}`, async () => {
    if (!gateResult.ok) {
      // Bad photo never reaches Pro → no charge. balance:null leaves the
      // client's known balance unchanged.
      await persistGateRejection(form, gateResult.imageHash, gateResult.rejection);
      log.info({ scanId, path: 'rejected', reject: gateResult.rejection.rejectReason }, 'palm scan: complete (rejected, no charge)');
      return { content: JSON.stringify(gateResult.rejection), balance: null };
    }
    return runProAndPersist({
      form, claimedHand,
      base64:    gateResult.base64,
      mimeType:  gateResult.mimeType,
      imageHash: gateResult.imageHash,
      scanId,
      landmarks,
    });
  });
}

// POST — analyze BOTH hands in ONE Pro 2.5 Vision call. Replaces the
// previous 3-call cascade (Pro left + Pro right + Flash synthesis) with a
// single multimodal Pro call that produces per-hand readings AND the
// comparison synthesis in one shot. Persists the combined result to
// PalmReading with handType="Both" so it shows in history alongside
// single-hand readings.
//
// Flow:
//   1. Gate both photos via Flash (or skip if web already MediaPipe-gated).
//      If EITHER fails, return rejection without spending Pro tokens.
//   2. Build a SHA-256 hash of (leftHash | rightHash) for dedupe.
//   3. Single Pro Vision call with BOTH images.
//   4. Save the parsed result with handType="Both".
export async function comparePalms({ form, leftImage, rightImage, skipGate }) {
  // Stage 1 — gate both photos. No Pro spend yet.
  const [leftGate, rightGate] = await Promise.all([
    runGate({ image: leftImage,  claimedHand: 'Left',  skipGate }),
    runGate({ image: rightImage, claimedHand: 'Right', skipGate }),
  ]);

  // Stage 2 — if EITHER hand failed the gate, return rejection without
  // calling Pro. Frontend renders the existing per-hand retake card.
  if (!leftGate.ok || !rightGate.ok) {
    // A failed gate never reaches Pro → no charge. balance:null leaves the
    // client's known balance unchanged.
    return {
      content: JSON.stringify({
        left:  leftGate.ok  ? { imageQuality: 'clear' } : leftGate.rejection,
        right: rightGate.ok ? { imageQuality: 'clear' } : rightGate.rejection,
        comparison: null,
      }),
      balance: null,
    };
  }

  // Combined hash for dedupe — same pair of photos uploaded twice returns
  // the cached combined reading instead of re-burning Pro tokens.
  const combinedHash = crypto.createHash('sha256')
    .update(leftGate.imageHash + '|' + rightGate.imageHash)
    .digest('hex');

  return dedupe(`palmBoth|${userKey(form)}|${combinedHash}`, async () => {
    const user = await findOrCreateUser(form);

    const fireInsightPush = () =>
      notifyInsightReady(user.phone || form.phone)
        .catch((err) => log.warn({ err: err.message }, 'palm-both-insight-ready push failed'));

    // Same pair already analyzed? Return the saved Both reading (free).
    const dup = await PalmReading.findOne({
      where: { userId: user.id, imageHash: combinedHash, imageQuality: 'clear' },
    });
    if (dup) return { content: asContent(dup.reading), balance: await getBalance(user.id) };

    // Fresh comparison → charge once (palm_cost). Throws 402 if short.
    const { charged, balance } = await charge({ userId: user.id, costKey: 'palm_cost', reason: 'palm', meta: { mode: 'compare' } });

    // Stage 3 — single Pro Vision call with BOTH images.
    const userPrompt =
      `NAME: ${form.name}\n` +
      `GENDER: ${form.gender || 'NOT SPECIFIED'}\n\n` +
      `Two palm photos follow. First image = LEFT hand (Potential). Second image = RIGHT hand (Reality). Read each and write the evolution story per the schema.`;

    let parsed;
    try {
      const raw = await callGeminiVisionMulti(
        PALM_BOTH_HANDS_SYSTEM, userPrompt,
        [
          { base64: leftGate.base64,  mimeType: leftGate.mimeType  },
          { base64: rightGate.base64, mimeType: rightGate.mimeType },
        ],
        true, PALM_MODELS, THINK_BUDGET.PALM,
      );
      parsed = JSON.parse(cleanJson(raw));
    } catch (e) {
      log.error({ err: e.message }, 'Both-hands Pro JSON parse failed');
      parsed = { handType: 'Both', imageQuality: 'unusable', retakeReason: 'Could not parse the comparison. Please try again.' };
    }

    // Stamp handType — Pro should have done this, but be defensive.
    parsed.handType = 'Both';

    // Unusable result → refund (don't bill for a comparison they can't use).
    let finalBalance = balance;
    if (parsed.imageQuality === 'unusable' && charged) {
      const refund = await grant({ userId: user.id, amount: charged, reason: 'refund', meta: { for: 'palm', mode: 'compare' } })
        .catch((err) => { log.warn({ err: err.message }, 'palm-compare refund failed'); return null; });
      if (refund) finalBalance = refund.balance;
    }

    // Stage 4 — persist the combined reading under handType="Both".
    try {
      await PalmReading.create({
        userId: user.id,
        handType: 'Both',
        imageQuality: parsed.imageQuality || 'clear',
        imageHash: combinedHash,
        reading: parsed,
      });
      if (parsed.imageQuality !== 'unusable') fireInsightPush();
    } catch (saveError) {
      log.error({ err: saveError }, 'Both-hands palm save failed');
    }

    // Adapt to the existing { left, right, comparison } response shape
    // the frontend already expects. The combined object has all three.
    const response = {
      left:  parsed.left  || { imageQuality: parsed.imageQuality || 'clear' },
      right: parsed.right || { imageQuality: parsed.imageQuality || 'clear' },
      comparison: parsed.imageQuality === 'unusable' ? null : parsed.comparison,
      handType: 'Both',
    };
    if (parsed.imageQuality === 'unusable') {
      response.left  = { imageQuality: 'unusable', retakeReason: parsed.retakeReason };
      response.right = { imageQuality: 'unusable', retakeReason: parsed.retakeReason };
    }
    return { content: JSON.stringify(response), balance: finalBalance };
  });
}
