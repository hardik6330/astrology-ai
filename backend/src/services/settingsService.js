// Runtime settings access with a short in-process cache. Feature code reads
// values through get*(); the admin panel writes through updateMany(), which
// busts the cache so the next read reflects the change immediately.
//
// The cache is per-process. On serverless (Vercel) each cold start gets its
// own, and the TTL bounds staleness on long-lived hosts (Render/Railway).

import { Setting } from '../models/index.js';

let cache = null;       // { key: value(string) }
let cachedAt = 0;
const TTL_MS = 60 * 1000;

async function ensure() {
  if (cache && Date.now() - cachedAt < TTL_MS) return cache;
  const rows = await Setting.findAll({ attributes: ['key', 'value'] });
  cache = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  cachedAt = Date.now();
  return cache;
}

// Raw string value (or undefined if the key isn't set).
export async function get(key) {
  return (await ensure())[key];
}

// Numeric value with a fallback for missing/non-numeric entries — callers that
// deduct/grant credits should always pass a sane default.
export async function getNumber(key, fallback = 0) {
  const n = Number(await get(key));
  return Number.isFinite(n) ? n : fallback;
}

// Full rows (incl. description) for the admin UI, stable-ordered by key.
export function getAll() {
  return Setting.findAll({ attributes: ['key', 'value', 'description'], order: [['key', 'ASC']] });
}

export function invalidate() {
  cache = null;
}

// Apply [{ key, value }] updates. Only existing keys are touched (Setting.update
// never inserts), so unknown keys are silently ignored. Busts the cache after.
export async function updateMany(updates) {
  for (const { key, value } of updates) {
    await Setting.update({ value: String(value) }, { where: { key } });
  }
  invalidate();
  return getAll();
}
