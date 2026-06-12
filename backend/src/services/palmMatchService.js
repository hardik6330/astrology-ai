// EXPERIMENTAL biometric palm matching. A NEW photo of a hand we've already
// read (this user OR another user/device) reuses the saved reading instead of
// calling Gemini. Matching uses LANDMARK GEOMETRY (the 21 MediaPipe points the
// client sends) — pose/scale-invariant, so different photos of the same hand
// can match. See utils/palmEmbedding.js for the embedding caveats.
//
// Split out of palmService.js so the Gemini reading flow and the biometric
// match/persist concerns stay single-purpose. palmService owns the gate + Pro
// call; this module owns embeddings, the 1:N search, and reading persistence.

import Jimp from 'jimp';
import { PalmReading, PalmEmbedding } from '../models/index.js';
import { charge, getBalance } from './creditService.js';
import { landmarkEmbedding, cosineSim } from '../utils/palmEmbedding.js';
import { asContent } from '../utils/asContent.js';
import { PALM_MATCH_THRESHOLD_AUTO, PALM_MATCH_THRESHOLD_ASK } from '../config/constants.js';
import { logger } from '../config/logger.js';

// Helper to compare two perceptual hashes (Texture)
function textureSim(h1, h2) {
  if (!h1 || !h2) return 0;
  try {
    const dist = Jimp.compareHashes(h1, h2);
    return 1 - dist; // Convert distance to similarity
  } catch { return 0; }
}

// Helper to compare binary line maps (Lines)
function lineSim(l1, l2) {
  if (!l1 || !l2 || !Array.isArray(l1) || !Array.isArray(l2)) return 0;
  let matches = 0;
  const len = Math.min(l1.length, l2.length);
  if (len === 0) return 0;
  for (let i = 0; i < len; i++) {
    if (l1[i] === l2[i]) matches++;
  }
  return matches / len;
}

// 1:N biometric search — uses 4-layer verification (Geometry, Texture, Lines)
async function findBiometricMatch({ handType, embedding, textureSignature, lineSignature, scanId, deviceId }) {
  const t = Date.now();
  
  // Layer 4: Device Filtering - Search only for this device's history first
  // to ensure 0% waste and high speed.
  const rows = await PalmEmbedding.findAll({
    where: { handType, deviceId },
    attributes: ['userId', 'palmReadingId', 'embedding', 'textureSignature', 'lineSignature', 'reading'],
  });
  
  let best = null;
  let secondBest = null;

  for (const r of rows) {
    if (!r.reading) continue;
    
    // Layer 1: Geometry (25%)
    const gSim = cosineSim(embedding, r.embedding);
    
    // Layer 2: Texture (50%)
    const tSim = textureSim(textureSignature, r.textureSignature);
    
    // Layer 3: Lines (25%)
    const lSim = lineSim(lineSignature, r.lineSignature);
    
    // Weighted final score
    const totalSim = (gSim * 0.25) + (tSim * 0.50) + (lSim * 0.25);
    
    if (!best || totalSim > best.sim) {
      secondBest = best;
      best = { 
        userId: r.userId, 
        palmReadingId: r.palmReadingId, 
        sim: totalSim, 
        reading: r.reading,
        breakdown: { gSim, tSim, lSim }
      };
    } else if (!secondBest || totalSim > secondBest.sim) {
      secondBest = { sim: totalSim };
    }
  }

  // Layer 4: Strict Matching Logic (97% Threshold)
  const isOldUser = !!best && best.sim >= 0.97;
  // If we have a second match, check the gap (optional but recommended in the flow)
  const hasGap = !secondBest || (best.sim - secondBest.sim) >= 0.05;

  const matchedAuto = isOldUser && hasGap;
  const matchedAsk  = !!best && best.sim >= 0.85; // Lower threshold for "Ask User"

  logger.info(
    { 
      scanId, stage: 'match', handType, deviceId,
      candidates: rows.length, 
      topSim: best ? Number(best.sim.toFixed(4)) : null, 
      matchedAuto, matchedAsk,
      ms: Date.now() - t 
    },
    'palm scan: biometric search (strict 97%)',
  );

  if (matchedAuto) return { ...best, matchType: 'auto' };
  if (matchedAsk)  return { ...best, matchType: 'ask' };
  return null;
}

// Persist a reading row for this user and (for clear readings) its embedding,
// so future photos of the same hand can match it. Best-effort — logs, doesn't throw.
export async function persistReadingWithEmbedding({ user, parsed, imageHash, embedding, textureSignature, lineSignature, deviceId }) {
  try {
    const row = await PalmReading.create({
      userId: user.id,
      deviceId,
      handType: parsed.handType,
      imageQuality: parsed.imageQuality,
      imageHash,
      reading: parsed,
    });
    if (embedding && parsed.imageQuality === 'clear') {
      await PalmEmbedding.create({
        userId: user.id, 
        deviceId,
        palmReadingId: row.id, 
        handType: parsed.handType, 
        embedding,
        textureSignature,
        lineSignature,
        reading: parsed, 
      }).catch((e) => logger.warn({ err: e.message }, 'Palm embedding save failed'));
    }
    return row.id;
  } catch (saveError) {
    logger.error({ err: saveError }, 'Palm save failed');
    return null;
  }
}

// Try to satisfy a scan from a saved reading of the same hand. Requires a
// known hand + the client-sent landmarks (needed to compute the geometry
// embedding). Failure anywhere is non-fatal — the caller falls through to a
// fresh Gemini analysis.
//
// Returns { result, embedding }:
//   result    — { content, balance } when a saved reading was reused, else null
//   embedding — the computed landmark embedding (null on failure), which the
//               caller persists alongside a fresh reading so future photos of
//               this hand can match it
export async function tryBiometricReuse({ user, claimedHand, landmarks, imageHash, scanId, t0, fireInsightPush, textureSignature, lineSignature, deviceId }) {
  let embedding = null;
  const handType = claimedHand || null;
  // Matching is ALWAYS on now — no DB flag.
  if (!handType || !Array.isArray(landmarks)) return { result: null, embedding };

  try {
    const tEmb = Date.now();
    embedding = landmarkEmbedding(landmarks);
    if (!embedding) throw new Error('landmark embedding unavailable');
    logger.info({ scanId, stage: 'embedding', dim: embedding.length, ms: Date.now() - tEmb }, 'palm scan: landmark embedding computed');
    
    const match = await findBiometricMatch({ handType, embedding, textureSignature, lineSignature, scanId, deviceId });
    if (match) {
      const baseReading = typeof match.reading === 'string'
        ? JSON.parse(match.reading) : match.reading;
      
      if (baseReading && baseReading.imageQuality === 'clear') {
        // match.matchType is 'auto' or 'ask'
        if (match.matchType === 'auto') {
          let balance;
          if (match.userId === user.id) {
            balance = await getBalance(user.id);
          } else {
            ({ balance } = await charge({ userId: user.id, costKey: 'palm_cost', reason: 'palm', meta: { matched: true } }));
          }
          const parsed = { ...baseReading, handType };
          await persistReadingWithEmbedding({ 
            user, 
            parsed, 
            imageHash, 
            embedding, 
            textureSignature, 
            lineSignature,
            deviceId
          });
          logger.info(
            { scanId, path: 'biometric-match-auto', matchedFrom: match.userId, sameUser: match.userId === user.id, sim: Number(match.sim.toFixed(4)), charged: match.userId !== user.id, totalMs: Date.now() - t0 },
            'palm scan: complete (reused — no AI call)',
          );
          fireInsightPush();
          return { result: { content: asContent(parsed), balance }, embedding };
        } else if (match.matchType === 'ask') {
          // Return a special flag to frontend to ask the user
          logger.info({ scanId, stage: 'match', matchType: 'ask', sim: Number(match.sim.toFixed(4)) }, 'palm scan: probably same hand, returning ask_user flag');
          return { 
            result: { 
              action: 'ask_user', 
              existingReading: asContent(baseReading),
              similarity: Number(match.sim.toFixed(4))
            }, 
            embedding 
          };
        }
      }
    }
  } catch (e) {
    logger.warn({ err: e.message }, 'Palm embedding/match failed — fresh analysis');
  }
  return { result: null, embedding };
}
