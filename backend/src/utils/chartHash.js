import { createHash } from 'node:crypto';

// Stable hash of a birth identity (name + date + time + city + gender), stored on
// User.chartHash. It's the match key for "sibling" profiles — different accounts
// that entered the SAME birth details — so their deterministic chart/daily
// readings can be reused instead of re-billing Gemini (see the sibling-copy in
// kundaliService / dailyService).
//
// Replaces the old 5-string-column join: one indexed lookup instead of a scan
// within each (name, birthDate) group. Inputs are normalized (trim + collapse
// internal whitespace) so trailing-space / double-space drift can't silently
// split two identical identities into non-matching rows. Case is PRESERVED, to
// keep the prior exact-match semantics (only whitespace noise is removed).
//
// Returns null when any core birth field is missing (e.g. a login placeholder),
// so such rows carry a NULL hash and never collide on an "empty" identity.
export function chartHashFor({ name, date, time, city, gender } = {}) {
  if (!name || !date || !time || !city) return null;
  const norm = (v) => String(v ?? '').trim().replace(/\s+/g, ' ');
  const key = [norm(name), norm(date), norm(time), norm(city), norm(gender)].join('|');
  return createHash('sha256').update(key).digest('hex');
}
