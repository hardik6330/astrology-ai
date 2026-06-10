// EXPERIMENTAL palm "embedding" — a lightweight, dependency-light descriptor we
// can compute on the backend so a NEW photo of the SAME hand still matches
// (unlike the SHA-256 imageHash, which only matches byte-identical re-uploads).
//
// This is NOT a trained palmprint biometric model. It is a crude appearance
// descriptor (normalized intensity + edge/line structure of the central palm
// ROI). It exists so we can wire up the full match pipeline — storage, 1:N
// search, tunable threshold — and TEST behaviour end to end. Swap
// `computeEmbedding` for a real palmprint CNN embedding later; the rest of the
// pipeline (PalmEmbedding table, cosineSim, threshold) stays the same.

import Jimp from 'jimp';

const GRID = 32;                 // ROI downscaled to GRID x GRID
export const EMBED_DIM = GRID * GRID * 2; // intensity block + edge block

// L2-normalize a vector in place (so cosine similarity == dot product).
function l2normalize(vec) {
  let sum = 0;
  for (let i = 0; i < vec.length; i++) sum += vec[i] * vec[i];
  const norm = Math.sqrt(sum) || 1;
  for (let i = 0; i < vec.length; i++) vec[i] /= norm;
  return vec;
}

// Decode base64 → grayscale → center-square crop → GRID×GRID, then build a
// descriptor from (a) contrast-normalized intensity and (b) Sobel edge
// magnitude (captures the palm's principal lines). Each block is L2-normalized
// independently, then the concatenation is L2-normalized as a whole.
export async function computeEmbedding(base64) {
  const buf = Buffer.from(base64, 'base64');
  const img = await Jimp.read(buf);

  // Center square crop — the palm is the dominant central object in our flow.
  const w = img.bitmap.width, h = img.bitmap.height;
  const side = Math.min(w, h);
  img.crop((w - side) >> 1, (h - side) >> 1, side, side)
     .grayscale()
     .resize(GRID, GRID)
     .normalize(); // stretch contrast → reduces lighting differences

  // Read luminance grid.
  const lum = new Float64Array(GRID * GRID);
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const idx = (img.bitmap.width * y + x) << 2;
      lum[y * GRID + x] = img.bitmap.data[idx]; // grayscale → R==G==B
    }
  }

  // Intensity block: zero-mean.
  let mean = 0;
  for (let i = 0; i < lum.length; i++) mean += lum[i];
  mean /= lum.length;
  const intensity = new Float64Array(GRID * GRID);
  for (let i = 0; i < lum.length; i++) intensity[i] = lum[i] - mean;

  // Edge block: Sobel gradient magnitude (palm-line structure).
  const edge = new Float64Array(GRID * GRID);
  const at = (x, y) => lum[Math.min(GRID - 1, Math.max(0, y)) * GRID + Math.min(GRID - 1, Math.max(0, x))];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const gx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1))
               - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const gy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1))
               - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      edge[y * GRID + x] = Math.sqrt(gx * gx + gy * gy);
    }
  }

  l2normalize(intensity);
  l2normalize(edge);
  const vec = new Array(EMBED_DIM);
  for (let i = 0; i < intensity.length; i++) vec[i] = intensity[i];
  for (let i = 0; i < edge.length; i++) vec[intensity.length + i] = edge[i];
  return l2normalize(vec);
}

// Normalize a stored embedding to a number[]. MySQL JSON columns can come back
// as a raw JSON string (driver/dialect dependent) instead of a parsed array —
// without this, cosineSim compares strings and always misses.
export function toVec(e) {
  if (Array.isArray(e)) return e;
  if (typeof e === 'string') {
    try { return JSON.parse(e); } catch { return null; }
  }
  return null;
}

// ── Landmark-geometry embedding ─────────────────────────────────────────────
// Build a pose/scale/rotation-invariant descriptor from the 21 MediaPipe hand
// landmarks (the client already computes these for the gate). The feature is
// the full set of pairwise landmark distances, normalized by a reference palm
// length — distances are inherently translation- AND rotation-invariant, and
// dividing by the reference makes them scale-invariant. Two open-palm photos of
// the SAME hand yield similar proportions (high cosine) even at different
// camera distances/angles; different hands differ in proportion. Far more
// robust than pixel appearance for "same hand, different photo".
//
// keypoints: [{x, y}, ...] (≥15). Returns a fixed-length number[] or null.
const LM_PARTS = 21; // we use the first 21 points if more are present
export const LANDMARK_DIM = (LM_PARTS * (LM_PARTS - 1)) / 2; // 210

function d2(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function landmarkEmbedding(keypoints) {
  if (!Array.isArray(keypoints) || keypoints.length < LM_PARTS) return null;
  const k = keypoints.slice(0, LM_PARTS);
  // Reference length: wrist (0) → middle-finger MCP (9). Stable across poses.
  const ref = d2(k[0], k[9]) || 1;
  const feats = new Array(LANDMARK_DIM);
  let n = 0;
  for (let i = 0; i < LM_PARTS; i++) {
    for (let j = i + 1; j < LM_PARTS; j++) {
      feats[n++] = d2(k[i], k[j]) / ref;
    }
  }
  return l2normalize(feats);
}

// Cosine similarity of two equal-length L2-normalized vectors → dot product.
// Returns a value in roughly [-1, 1]; higher = more similar. Accepts arrays or
// JSON-string embeddings (parses via toVec).
export function cosineSim(a, b) {
  a = toVec(a); b = toVec(b);
  if (!a || !b || a.length !== b.length) return -1;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}
