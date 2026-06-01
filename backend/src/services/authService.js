// Phone-OTP auth. The actual OTP delivery + verification happens on the
// client via Firebase; we only ever see the resulting Firebase ID token,
// verify it server-side with firebase-admin, then mint our own session JWT.
//
// The `dummyLogin` path is a stand-in for while real Firebase Phone Auth
// isn't wired up on a client — it trades a bare phone number for a JWT.

import { Op } from 'sequelize';
import { verifyIdToken } from '../config/firebase.js';
import { AuthAccount, User, Location } from '../models/index.js';
import { signAppToken } from '../middleware/auth.js';
import { AppError } from '../errors/AppError.js';
import { logger } from '../config/logger.js';

const log = logger.child({ mod: 'auth' });

// Look up the most recently saved User row for this phone so a returning
// user can skip the birth-details form and land straight on their kundali.
async function findSavedFormByPhone(phone) {
  if (!phone) return null;
  // Skip placeholder rows missing a name — those were created by older flows
  // and would hydrate the client form with an empty name, breaking lookups.
  const user = await User.findOne({
    where: { phone, name: { [Op.ne]: '' } },
    order: [['updatedAt', 'DESC']],
  });
  if (!user) return null;
  // The User table doesn't yet carry lat/lon/tz — look up the cached
  // Location row by city name so the client can rebuild the chart without
  // forcing the user back through the picker. Falls back to nulls when the
  // city isn't in the cache (returning user will be sent to re-pick).
  const loc = await Location.findOne({ where: { searchName: user.birthCity } });
  return {
    name:    user.name,
    gender:  user.gender || '',
    date:    user.birthDate,
    time:    user.birthTime,
    city:    user.birthCity,
    lat:     loc?.lat      ?? null,
    lon:     loc?.lng      ?? null,
    tz:      loc?.tzOffset ?? null,
    tzId:    loc?.tzId     ?? null,
    placeId: loc?.placeId  ?? null,
  };
}

// Upsert the auth ledger row for a (firebaseUid, phone) pair and stamp the
// login time. Returns the AuthAccount.
async function upsertAccount(firebaseUid, phone) {
  const [account] = await AuthAccount.findOrCreate({
    where: { firebaseUid },
    defaults: { firebaseUid, phone, lastLoginAt: new Date() },
  });
  await account.update({ phone, lastLoginAt: new Date() });
  return account;
}

// Verify a Firebase ID token, upsert the account, return token + account.
export async function verifyOtp(idToken) {
  let decoded;
  try {
    decoded = await verifyIdToken(idToken);
  } catch (err) {
    log.warn({ err: err.message }, 'Firebase token verification failed');
    throw new AppError('invalid_id_token', 401, 'INVALID_ID_TOKEN');
  }

  const phone = decoded.phone_number || null;
  if (!phone) throw new AppError('no_phone_in_token', 400, 'NO_PHONE_IN_TOKEN');

  const account = await upsertAccount(decoded.uid, phone);
  const token = signAppToken({
    accountId:   account.id,
    firebaseUid: account.firebaseUid,
    phone:       account.phone,
  });

  return { token, account: { id: account.id, phone: account.phone } };
}

// Dummy login — trades a raw phone number for a real session JWT. Used while
// real Firebase Phone Auth isn't wired up on the client. Returns the saved
// birth form too, so a returning user skips the home form.
export async function dummyLogin(rawPhone) {
  // Normalise to the canonical 10-digit local number — strips +91, spaces,
  // dashes, leading zeros, etc. Old rows saved as "+919876543210" and new
  // clients sending "9876543210" both resolve to the same UID.
  const digits = rawPhone.replace(/[^\d]/g, '').slice(-10);
  if (digits.length !== 10) throw new AppError('invalid_phone', 400, 'INVALID_PHONE');

  // Synthetic firebaseUid keyed on phone so dummy and real Firebase accounts
  // can't collide. Real Firebase UIDs are 28 alphanumerics; ours are prefixed
  // `dummy_` and clearly distinguishable.
  const account = await upsertAccount(`dummy_${digits}`, digits);
  const token = signAppToken({
    accountId:   account.id,
    firebaseUid: account.firebaseUid,
    phone:       account.phone,
  });

  const savedForm = await findSavedFormByPhone(digits);
  log.info({ phone: digits, accountId: account.id, returning: !!savedForm }, 'dummy login');

  return { token, account: { id: account.id, phone: account.phone }, savedForm };
}
