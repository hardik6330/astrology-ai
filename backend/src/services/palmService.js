import crypto from 'node:crypto';
import { Op } from 'sequelize';
import { PalmReading } from '../models/index.js';
import { callGeminiVision, callGeminiVisionMulti } from '../ai/gemini.js';
import { PALM_SYSTEM, PALM_GATE_SYSTEM, PALM_BOTH_HANDS_SYSTEM } from '../ai/prompts.js';
import { dedupe } from '../ai/dedupe.js';
import { findOrCreateUser, findUserByForm } from './userService.js';
import { charge, grant, getBalance } from './creditService.js';
import { notifyInsightReady } from './pushService.js';
import { buildPalmGeometry } from '../utils/palmGeometry.js';
import { enhancePalmImage } from '../utils/palmImage.js';
import { validateImage } from '../utils/imageValidator.js';
import { asContent } from '../utils/asContent.js';
import { cleanJson } from '../utils/cleanJson.js';
import { sanitizeInline } from '../utils/promptSafety.js';
import { userKey } from '../utils/userKey.js';
import { PALM_MODELS, PALM_GATE_MODELS, THINK_BUDGET } from '../config/constants.js';
import { AppError } from '../errors/AppError.js';
import { logger } from '../config/logger.js';

const log = logger.child({ mod: 'palm' });

// Handedness from landmark GEOMETRY — the same calibrated rule the client gates
// run (frontend/src/utils/palmGate.js, mobile/.../palmGate.js). Server-side copy
// so the wrong-hand check still holds even when the client gate failed open
// (Expo Go / detector crash) or is a stale build. With the palm facing the
// camera and fingers up, a NON-mirrored photo puts the thumb on the image-LEFT
// for a RIGHT hand and image-RIGHT for a LEFT hand. Returns null when the
// thumb/pinky split is too small to call (hand rotated / pointing at camera).
function geometricHand(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length < 21) return null;
  const thumbTip = landmarks[4], pinkyMcp = landmarks[17], indexMcp = landmarks[5];
  if (!thumbTip || !pinkyMcp || !indexMcp) return null;
  const palmWidth = Math.abs(indexMcp.x - pinkyMcp.x) || 1;
  const dx = thumbTip.x - pinkyMcp.x;
  if (Math.abs(dx) < palmWidth * 0.15) return null;
  // Calibrated from live testing: thumb on the image-RIGHT of the pinky (dx > 0)
  // = a RIGHT hand. Keep in sync with the web + mobile gates.
  return dx > 0 ? 'Right' : 'Left';
}

// M2 — `skipGate` is a CLIENT flag, so it can't be trusted on its own: a
// hand-rolled client could send skipGate=true with junk to push an ungated
// image straight to the expensive Pro vision call. We honor the skip ONLY when
// the request also carries CREDIBLE landmark evidence that the local MediaPipe
// gate genuinely ran — 21 finite points in the normalized range, with real
// 2-D spread, that buildPalmGeometry accepts. Fabricating that is far harder
// than flipping a boolean; anything less falls through to the server Flash gate.
export function landmarksCredible(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length < 21) return false;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < 21; i++) {
    const p = landmarks[i];
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
    // MediaPipe normalizes to ~[0,1]; allow slack for points just off-frame.
    if (p.x < -0.5 || p.x > 1.5 || p.y < -0.5 || p.y > 1.5) return false;
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }
  // A real hand spans a meaningful fraction of the frame — reject a cluster of
  // near-identical points (a trivial forgery that would still pass geometry).
  if (maxX - minX < 0.05 || maxY - minY < 0.05) return false;
  // Final gate: the same builder the reading uses must accept it (non-zero palm
  // width AND height — i.e. a real, non-degenerate hand).
  return buildPalmGeometry(landmarks) !== null;
}

// GET the latest saved USABLE palm reading. Unusable results are persisted
// (history shows them as unreadable) but must never be auto-restored as "the
// saved reading" — otherwise one failed scan re-surfaces its error card on
// every later visit until a new reading replaces it.
export async function getSavedPalm(form) {
  const user = await findUserByForm(form);
  if (!user) return null;
  const palm = await PalmReading.findOne({
    where: { userId: user.id, imageQuality: { [Op.ne]: 'unusable' } },
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
// If `skipGate` is true AND the client supplied credible landmark evidence that
// its local MediaPipe gate actually ran, the Flash call is bypassed and the
// photo is declared usable. A skip request WITHOUT credible landmarks is not
// trusted (M2) — it falls through to the server Flash gate.
async function runGate({ image, claimedHand, skipGate = false, landmarks = null, scanId }) {
  const t = Date.now();
  let mimeType, base64;
  try {
    ({ mime: mimeType, base64 } = validateImage(image));
  } catch (e) {
    throw AppError.http(400, e.message, 'INVALID_IMAGE');
  }
  const imageHash = crypto.createHash('sha256').update(base64).digest('hex');
  const kb = Math.round((base64.length * 0.75) / 1024);

  // Honor the client skip ONLY with credible landmark proof the local gate ran
  // (M2). Otherwise fall through to the Flash gate — never trust the bare flag.
  if (skipGate) {
    if (landmarksCredible(landmarks)) {
      log.info({ scanId, stage: 'gate', skipGate: true, trusted: true, kb, hash: imageHash.slice(0, 8), ms: Date.now() - t }, 'palm scan: gate skipped (client-gated, landmarks verified)');
      return { ok: true, base64, mimeType, imageHash };
    }
    log.warn({ scanId, stage: 'gate', skipGate: true, trusted: false, kb, hash: imageHash.slice(0, 8) }, 'palm scan: skip requested without credible landmarks — running server gate');
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

  // Per-[account, hand] cache: this account already has a CLEAR reading for this
  // hand → return it instead of calling Gemini. The account is the phone
  // (Firebase auth), so the SAME reading serves cross-platform (mobile ↔ web)
  // and across reinstalls. Free — it's the user's own saved reading. One reading
  // per hand per account; re-scanning the same hand always returns this one.
  if (claimedHand) {
    const cachedHand = await PalmReading.findOne({
      where: { userId: user.id, handType: claimedHand, imageQuality: 'clear' },
      order: [['createdAt', 'DESC']],
    });
    if (cachedHand) {
      log.info({ scanId, path: 'cache-hit', reason: 'saved hand reading', hand: claimedHand, totalMs: Date.now() - t0 }, 'palm scan: complete (cached hand, no AI)');
      return { content: asContent(cachedHand.reading), balance: await getBalance(user.id) };
    }
  }

  // Fresh analysis → charge once (a same-image re-view or cached hand above is free).
  // Throws 402 INSUFFICIENT_CREDITS if the balance is short.
  const { charged, balance } = await charge({ userId: user.id, costKey: 'palm_cost', reason: 'palm' });

  let parsed;
  // Geometry hints (palm element, finger ratios, thumb angle, Mercury reach)
  // computed from the client's landmarks — sharpens shape/finger observations
  // Gemini can't measure precisely from pixels. See utils/palmGeometry.js.
  // Hoisted so we can attach it to the reading below ("Show Your Work" badge:
  // the palm-math evidence is MEASURED here, never invented by the model).
  const geo = buildPalmGeometry(landmarks);
  const tAI = Date.now();
  try {
      const geometryData = geo ? JSON.stringify(geo) : 'N/A';

      const userPrompt =
        `NAME: ${sanitizeInline(form.name)}\n` +
        `GENDER: ${sanitizeInline(form.gender || 'NOT SPECIFIED')}\n` +
        `PALM_GEOMETRY (FIXED measured facts about this hand — identical across photos): ${geometryData}\n` +
        `  palmShape=square|rectangular; element=hand element; fingerLength=long|short; ` +
        `dominantFinger=Jupiter(leadership)|Apollo(creativity)|balanced; thumb=flexible|balanced|reserved; ` +
        `mercury=pinky long|short.\n\n` +
        `RULES:\n` +
        `- The element, palmShape, fingerLength, dominantFinger and thumb traits are MEASURED — state the ` +
        `personality reading for those STRICTLY from the buckets above. Do NOT contradict them or re-estimate ` +
        `them from the photo. Same buckets → same wording.\n` +
        `- Read the LINES (life/head/heart/fate) and MOUNTS from the PHOTO — geometry can't see those.\n` +
        `Analyze this palm photograph accordingly.`;

      // Lightly normalize + contrast the photo (Jimp) so creases read clearer for
      // the model. Best-effort — falls back to the original on any failure.
      const tEnh = Date.now();
      const enhanced = await enhancePalmImage(base64);
      log.info({ scanId, stage: 'enhance', applied: enhanced.enhanced, ms: Date.now() - tEnh }, 'palm scan: image normalize');

      log.info({ scanId, stage: 'ai', models: PALM_MODELS }, 'palm scan: calling Gemini vision…');
      const raw = await callGeminiVision(PALM_SYSTEM, userPrompt, enhanced.base64, enhanced.mimeType, true, PALM_MODELS, THINK_BUDGET.PALM);
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

  // Attach the MEASURED geometry buckets so the client can render the
  // "Palmistry Math" evidence badge from real landmark data (not model guesses).
  if (geo && parsed.imageQuality !== 'unusable') {
    parsed.geometry = geo;
  }

  // Unusable result → refund: the user shouldn't pay for a reading they can't use.
  let finalBalance = balance;
  if (parsed.imageQuality === 'unusable' && charged) {
    const refund = await grant({ userId: user.id, amount: charged, reason: 'refund', meta: { for: 'palm' } })
      .catch((err) => { log.warn({ err: err.message }, 'palm refund failed'); return null; });
    if (refund) finalBalance = refund.balance;
  }

  // Persist the reading (never the image bytes — only the hash + AI output).
  try {
    await PalmReading.create({
      userId: user.id,
      handType: parsed.handType,
      imageQuality: parsed.imageQuality,
      imageHash,
      reading: parsed,
    });
  } catch (saveError) {
    log.error({ scanId, err: saveError.message }, 'palm save failed');
  }
  if (parsed.imageQuality !== 'unusable') fireInsightPush();

  log.info(
    { scanId, path: 'fresh-ai', quality: parsed.imageQuality, refunded: parsed.imageQuality === 'unusable' && !!charged, totalMs: Date.now() - t0 },
    'palm scan: complete (fresh reading)',
  );
  return { content: parsed, balance: finalBalance };
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
  const gateResult = await runGate({ image, claimedHand, skipGate, landmarks, scanId });

  if (!gateResult.ok) {
    await persistGateRejection(form, gateResult.imageHash, gateResult.rejection);
    log.info({ scanId, path: 'rejected', reject: gateResult.rejection.rejectReason }, 'palm scan: complete (rejected, no charge)');
    return { content: gateResult.rejection, balance: null };
  }

  // Server-side handedness guard. The client gate also checks this, but it fails
  // open (no landmarks / Expo Go) and can be a stale build — so enforce here too
  // whenever the client sent landmarks. No charge: this returns before Pro.
  const detectedHand = geometricHand(landmarks);
  if (claimedHand && detectedHand && detectedHand !== claimedHand) {
    log.info({ scanId, path: 'rejected', reject: 'wrong_hand', detectedHand, claimedHand }, 'palm scan: complete (wrong hand, server geometry)');
    return {
      content: {
        handType: 'Unclear',
        imageQuality: 'unusable',
        rejectReason: 'wrong_hand',
        retakeReason: 'The photo looks like your other hand — please retake with the hand you selected.',
      },
      balance: null,
    };
  }

  return runProAndPersist({
    form, claimedHand,
    base64:    gateResult.base64,
    mimeType:  gateResult.mimeType,
    imageHash: gateResult.imageHash,
    scanId,
    landmarks,
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
export async function comparePalms({ form, leftImage, rightImage, skipGate, leftLandmarks, rightLandmarks }) {
  // Stage 1 — gate both photos. No Pro spend yet.
  const [leftGate, rightGate] = await Promise.all([
    runGate({ image: leftImage,  claimedHand: 'Left',  skipGate, landmarks: leftLandmarks }),
    runGate({ image: rightImage, claimedHand: 'Right', skipGate, landmarks: rightLandmarks }),
  ]);

  // Stage 2 — if EITHER hand failed the gate, return rejection without
  // calling Pro. Frontend renders the existing per-hand retake card.
  if (!leftGate.ok || !rightGate.ok) {
    // A failed gate never reaches Pro → no charge. balance:null leaves the
    // client's known balance unchanged.
    return {
      content: {
        left:  leftGate.ok  ? { imageQuality: 'clear' } : leftGate.rejection,
        right: rightGate.ok ? { imageQuality: 'clear' } : rightGate.rejection,
        comparison: null,
      },
      balance: null,
    };
  }

  // Server-side handedness guard (defense-in-depth, same as analyzePalm): the
  // LEFT slot must be a left hand and the RIGHT slot a right hand. Runs whenever
  // the client sent per-hand landmarks; skipped (null) when it didn't. No charge.
  const leftDetected = geometricHand(leftLandmarks);
  const rightDetected = geometricHand(rightLandmarks);
  const leftWrong = leftDetected && leftDetected !== 'Left';
  const rightWrong = rightDetected && rightDetected !== 'Right';
  if (leftWrong || rightWrong) {
    return {
      content: {
        left: leftWrong
          ? { imageQuality: 'unusable', rejectReason: 'wrong_hand', retakeReason: 'This looks like your right hand — retake your LEFT hand.' }
          : { imageQuality: 'clear' },
        right: rightWrong
          ? { imageQuality: 'unusable', rejectReason: 'wrong_hand', retakeReason: 'This looks like your left hand — retake your RIGHT hand.' }
          : { imageQuality: 'clear' },
        comparison: null,
      },
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
    // Layer 5: Temperature = 0 for consistency
    const userPrompt =
      `NAME: ${sanitizeInline(form.name)}\n` +
      `GENDER: ${sanitizeInline(form.gender || 'NOT SPECIFIED')}\n\n` +
      `Two palm photos follow. First image = LEFT hand (Potential). Second image = RIGHT hand (Reality). Read each and write the evolution story per the schema.`;

    let parsed;
    try {
      const raw = await callGeminiVisionMulti(
        PALM_BOTH_HANDS_SYSTEM, userPrompt,
        [
          { base64: leftGate.base64,  mimeType: leftGate.mimeType  },
          { base64: rightGate.base64, mimeType: rightGate.mimeType },
        ],
        true, PALM_MODELS, THINK_BUDGET.PALM
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
    return { content: response, balance: finalBalance };
  });
}
