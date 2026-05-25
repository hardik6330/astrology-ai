import crypto from 'node:crypto';
import { PalmReading } from '../models/index.js';
import { callGeminiVision } from '../ai/gemini.js';
import { PALM_SYSTEM } from '../ai/prompts.js';
import { dedupe } from '../ai/dedupe.js';
import { findOrCreateUser, findUserByForm } from './userService.js';
import { validateImage } from '../utils/imageValidator.js';
import { asContent } from '../utils/asContent.js';
import { cleanJson } from '../utils/cleanJson.js';
import { userKey } from '../utils/userKey.js';
import { KUNDLI_MODELS, THINK_BUDGET } from '../config/constants.js';
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
export async function analyzePalm({ image, form }) {
  // 1. Magic-byte validation.
  let mimeType, base64;
  try {
    ({ mime: mimeType, base64 } = validateImage(image));
  } catch (e) {
    throw httpError(400, e.message, 'INVALID_IMAGE');
  }
  const imageHash = crypto.createHash('sha256').update(base64).digest('hex');

  return dedupe(`palm|${userKey(form)}`, async () => {
    const user = await findOrCreateUser(form);

    // 2. Same image already analyzed? Return cached reading.
    const dup = await PalmReading.findOne({ where: { userId: user.id, imageHash } });
    if (dup) return asContent(dup.reading);

    // 3. Call Gemini Vision (Pro only — no fallback. If Pro fails 3×, the
    // overload error bubbles up to the frontend's retry countdown).
    const userPrompt = `NAME: ${form.name}\nGENDER: ${form.gender || 'NOT SPECIFIED'}\n\nAnalyze this palm photograph.`;
    const raw = await callGeminiVision(PALM_SYSTEM, userPrompt, base64, mimeType, true, KUNDLI_MODELS, THINK_BUDGET.PALM);

    // 4. Sanitize + parse + persist (new row each time → preserves history).
    const cleaned = cleanJson(raw);
    let parsed;
    try {
      parsed = typeof raw === 'string' ? JSON.parse(cleaned) : raw;
    } catch (e) {
      log.error({ err: e.message }, 'Palm JSON parse failed');
      parsed = { handType: 'Unclear', imageQuality: 'unusable', retakeReason: 'Could not parse reading. Please try again.' };
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

    // Return the SANITIZED string so the frontend's JSON.parse always succeeds.
    return cleaned;
  });
}
