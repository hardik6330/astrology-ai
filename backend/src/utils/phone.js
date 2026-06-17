import { Op } from 'sequelize';

// Phone normalization + matching, shared by every place that resolves a user or
// account from a phone number.
//
// The old rule kept only the LAST 10 DIGITS (`.slice(-10)`) — an India-specific
// assumption, since Indian mobile numbers are 10 digits. That is wrong for
// international numbers in two ways:
//   1. It silently drops the country code, so longer numbers mismatch.
//   2. Two different countries' numbers can share the same trailing 10 digits,
//      so a caller could be resolved to ANOTHER country's account (an IDOR).
// Keeping the FULL number (country code included) and matching it EXACTLY fixes
// both. Firebase hands us clean E.164 ("+<cc><number>").

// Reduce a phone to its full digit string (E.164 without the '+'). Returns ''
// for anything too short to be a real number.
export function normalizePhone(p) {
  const digits = String(p || '').replace(/\D/g, '');
  return digits.length >= 8 ? digits : '';
}

// Sequelize WHERE value matching a stored phone against `p`, EXACTLY (no suffix
// wildcard — a wildcard would re-open the cross-country collision above). Covers
// both formats the app stores: E.164 with the leading '+' (real Firebase OTP)
// and bare digits (dummy login). Returns null when `p` can't be normalized, so
// callers can short-circuit to "no match".
export function phoneWhere(p) {
  const digits = normalizePhone(p);
  if (!digits) return null;
  return { [Op.in]: [`+${digits}`, digits] };
}
