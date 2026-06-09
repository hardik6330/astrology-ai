import crypto from 'node:crypto';
import { PalmReading } from '../models/index.js';
import { callGeminiVision, callGeminiVisionMulti } from '../ai/gemini.js';
import { PALM_SYSTEM, PALM_GATE_SYSTEM, PALM_BOTH_HANDS_SYSTEM } from '../ai/prompts.js';
import { dedupe } from '../ai/dedupe.js';
import { findOrCreateUser, findUserByForm } from './userService.js';
import { charge, grant, getBalance } from './creditService.js';
import { notifyInsightReady } from './pushService.js';
import { validateImage } from '../utils/imageValidator.js';
import { asContent } from '../utils/asContent.js';
import { cleanJson } from '../utils/cleanJson.js';
import { userKey } from '../utils/userKey.js';
import { KUNDLI_MODELS, PALM_GATE_MODELS, THINK_BUDGET } from '../config/constants.js';
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
async function runGate({ image, claimedHand, skipGate = false }) {
  let mimeType, base64;
  try {
    ({ mime: mimeType, base64 } = validateImage(image));
  } catch (e) {
    throw AppError.http(400, e.message, 'INVALID_IMAGE');
  }
  const imageHash = crypto.createHash('sha256').update(base64).digest('hex');

  // Web has already gated this photo locally with MediaPipe — skip the
  // duplicate Flash call to save the token.
  if (skipGate) return { ok: true, base64, mimeType, imageHash };

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
  return { ok: true, base64, mimeType, imageHash };
}

// Run Pro + persistence. Assumes the gate has already passed.
async function runProAndPersist({ form, claimedHand, base64, mimeType, imageHash }) {
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
  if (dup) return { content: asContent(dup.reading), balance: await getBalance(user.id) };

  // Fresh analysis → charge once (dups above are free). Throws 402
  // INSUFFICIENT_CREDITS if the balance is short.
  const { charged, balance } = await charge({ userId: user.id, costKey: 'palm_cost', reason: 'palm' });

  let parsed;
  try {
    const userPrompt = `NAME: ${form.name}\nGENDER: ${form.gender || 'NOT SPECIFIED'}\n\nAnalyze this palm photograph.`;
    const raw = await callGeminiVision(PALM_SYSTEM, userPrompt, base64, mimeType, true, KUNDLI_MODELS, THINK_BUDGET.PALM);
    const cleaned = cleanJson(raw);
    parsed = typeof raw === 'string' ? JSON.parse(cleaned) : raw;
  } catch (e) {
    log.error({ err: e.message }, 'Palm JSON parse failed');
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

  try {
    await PalmReading.create({
      userId: user.id,
      handType: parsed.handType,
      imageQuality: parsed.imageQuality,
      imageHash,
      reading: parsed,
    });
    // Newly persisted reading — notify the user.
    if (parsed.imageQuality !== 'unusable') fireInsightPush();
  } catch (saveError) {
    log.error({ err: saveError }, 'Palm save failed');
  }

  return { content: JSON.stringify(parsed), balance: finalBalance };
}

// Gate rejections are NO LONGER persisted. They're cheap to re-compute and
// caching them makes retries impossible (a one-off bad-lighting attempt
// becomes permanent). Pro readings are still persisted in runProAndPersist.
async function persistGateRejection(_form, _imageHash, _rejection) {
  /* intentionally a no-op — see comment above */
}

export async function analyzePalm({ image, form, claimedHand, skipGate }) {
  // Stage 1 — gate. We need the image hash to build the dedupe key, so the
  // gate runs before dedupe. The Flash call is cheap and we'd hit cache for
  // truly identical retries via the per-image PalmReading row inside Pro.
  const gateResult = await runGate({ image, claimedHand, skipGate });

  return dedupe(`palm|${userKey(form)}|${gateResult.imageHash}`, async () => {
    if (!gateResult.ok) {
      // Bad photo never reaches Pro → no charge. balance:null leaves the
      // client's known balance unchanged.
      await persistGateRejection(form, gateResult.imageHash, gateResult.rejection);
      return { content: JSON.stringify(gateResult.rejection), balance: null };
    }
    return runProAndPersist({
      form, claimedHand,
      base64:    gateResult.base64,
      mimeType:  gateResult.mimeType,
      imageHash: gateResult.imageHash,
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
        true, KUNDLI_MODELS, THINK_BUDGET.PALM,
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
