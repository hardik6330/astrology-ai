import crypto from 'node:crypto';
import { PalmReading } from '../models/index.js';
import { callGeminiVision, callGeminiVisionMulti } from '../ai/gemini.js';
import { PALM_SYSTEM, PALM_GATE_SYSTEM, PALM_BOTH_HANDS_SYSTEM } from '../ai/prompts.js';
import { dedupe } from '../ai/dedupe.js';
import { findOrCreateUser, findUserByForm } from './userService.js';
import { validateImage } from '../utils/imageValidator.js';
import { asContent } from '../utils/asContent.js';
import { cleanJson } from '../utils/cleanJson.js';
import { userKey } from '../utils/userKey.js';
import { KUNDLI_MODELS, PALM_GATE_MODELS, THINK_BUDGET } from '../config/constants.js';
import { httpError } from '../middleware/errorHandler.js';
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
    throw httpError(400, e.message, 'INVALID_IMAGE');
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

  // Same image already analyzed (e.g. user retries same photo)? Only
  // dedupe SUCCESSFUL readings — never short-circuit on a cached
  // "unusable" row, otherwise a one-time rejection (gate misfire,
  // bad-lighting attempt, etc.) gets sticky and the user can never retry
  // the same photo.
  const dup = await PalmReading.findOne({
    where: { userId: user.id, imageHash, imageQuality: 'clear' },
  });
  if (dup) return asContent(dup.reading);

  const userPrompt = `NAME: ${form.name}\nGENDER: ${form.gender || 'NOT SPECIFIED'}\n\nAnalyze this palm photograph.`;
  const raw = await callGeminiVision(PALM_SYSTEM, userPrompt, base64, mimeType, true, KUNDLI_MODELS, THINK_BUDGET.PALM);

  const cleaned = cleanJson(raw);
  let parsed;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(cleaned) : raw;
  } catch (e) {
    log.error({ err: e.message }, 'Palm JSON parse failed');
    parsed = { handType: 'Unclear', imageQuality: 'unusable', retakeReason: 'Could not parse reading. Please try again.' };
  }

  if (claimedHand && parsed.imageQuality !== 'unusable') {
    parsed.handType = claimedHand;
  }

  try {
    await PalmReading.create({
      userId: user.id,
      handType: parsed.handType,
      imageQuality: parsed.imageQuality,
      imageHash,
      reading: parsed,
    });
  } catch (saveError) {
    log.error({ err: saveError }, 'Palm save failed');
  }

  return JSON.stringify(parsed);
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
      await persistGateRejection(form, gateResult.imageHash, gateResult.rejection);
      return JSON.stringify(gateResult.rejection);
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
    return JSON.stringify({
      left:  leftGate.ok  ? { imageQuality: 'clear' } : leftGate.rejection,
      right: rightGate.ok ? { imageQuality: 'clear' } : rightGate.rejection,
      comparison: null,
    });
  }

  // Combined hash for dedupe — same pair of photos uploaded twice returns
  // the cached combined reading instead of re-burning Pro tokens.
  const combinedHash = crypto.createHash('sha256')
    .update(leftGate.imageHash + '|' + rightGate.imageHash)
    .digest('hex');

  return dedupe(`palmBoth|${userKey(form)}|${combinedHash}`, async () => {
    const user = await findOrCreateUser(form);

    // Same pair already analyzed? Return the saved Both reading.
    const dup = await PalmReading.findOne({
      where: { userId: user.id, imageHash: combinedHash, imageQuality: 'clear' },
    });
    if (dup) return asContent(dup.reading);

    // Stage 3 — single Pro Vision call with BOTH images.
    const userPrompt =
      `NAME: ${form.name}\n` +
      `GENDER: ${form.gender || 'NOT SPECIFIED'}\n\n` +
      `Two palm photos follow. First image = LEFT hand (Potential). Second image = RIGHT hand (Reality). Read each and write the evolution story per the schema.`;

    const raw = await callGeminiVisionMulti(
      PALM_BOTH_HANDS_SYSTEM, userPrompt,
      [
        { base64: leftGate.base64,  mimeType: leftGate.mimeType  },
        { base64: rightGate.base64, mimeType: rightGate.mimeType },
      ],
      true, KUNDLI_MODELS, THINK_BUDGET.PALM,
    );

    let parsed;
    try {
      parsed = JSON.parse(cleanJson(raw));
    } catch (e) {
      log.error({ err: e.message }, 'Both-hands Pro JSON parse failed');
      parsed = { handType: 'Both', imageQuality: 'unusable', retakeReason: 'Could not parse the comparison. Please try again.' };
    }

    // Stamp handType — Pro should have done this, but be defensive.
    parsed.handType = 'Both';

    // Stage 4 — persist the combined reading under handType="Both".
    try {
      await PalmReading.create({
        userId: user.id,
        handType: 'Both',
        imageQuality: parsed.imageQuality || 'clear',
        imageHash: combinedHash,
        reading: parsed,
      });
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
    return JSON.stringify(response);
  });
}
