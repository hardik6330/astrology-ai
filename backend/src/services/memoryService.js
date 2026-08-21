// Chart memory: the user's Timeline Check answers and the Gochar alignments
// they've already asked about. Small, append-mostly, read once per session.
//
// Keys are opaque client strings; the server never interprets them. The UNIQUE
// index is on sha256(key) so an arbitrarily long key (a timelineCheck embeds a
// whole question) still gets exact-match uniqueness.

import { createHash } from 'node:crypto';
import { ChartMemory } from '../models/index.js';

const hash = (key) => createHash('sha256').update(key).digest('hex');

// Everything this account remembers, as a plain { key: value } map.
export async function getAll(accountId) {
  const rows = await ChartMemory.findAll({
    where: { accountId },
    attributes: ['key', 'value'],
  });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

// Upsert one entry. Last write wins — these are user answers, not a ledger.
export async function set(accountId, key, value) {
  const keyHash = hash(key);
  const [row, created] = await ChartMemory.findOrCreate({
    where: { accountId, keyHash },
    defaults: { accountId, key, keyHash, value },
  });
  if (!created) await row.update({ value, key });
  return { key, value };
}
