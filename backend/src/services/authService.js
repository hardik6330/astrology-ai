// Phone-OTP auth. The actual OTP delivery + verification happens on the
// client via Firebase; we only ever see the resulting Firebase ID token,
// verify it server-side with firebase-admin, then mint our own session JWT.

import { Op } from 'sequelize';
import { verifyIdToken } from '../config/firebase.js';
import { AuthAccount, User, Location, Kundali } from '../models/index.js';
import { ensureUserForPhone } from './userService.js';
import { signAppToken } from '../middleware/auth.js';
import { phoneWhere, normalizePhone } from '../utils/phone.js';
import { AppError } from '../errors/AppError.js';
import { env } from '../config/envConfig.js';
import { logger } from '../config/logger.js';

const log = logger.child({ mod: 'auth' });

// Look up the most recently saved User row for this phone so a returning
// user can skip the birth-details form and land straight on their kundali.
export async function findSavedFormByPhone(phone) {
  // Full-number match (see utils/phone.js) so a real-OTP account (E.164
  // "+917487998866") finds its User row regardless of country code length.
  const phoneMatch = phoneWhere(phone);
  if (!phoneMatch) return null;
  // Skip placeholder rows missing a name — those were created by older flows
  // and would hydrate the client form with an empty name, breaking lookups.
  const user = await User.findOne({
    where: { phone: phoneMatch, name: { [Op.ne]: '' } },
    order: [['updatedAt', 'DESC']],
  });
  if (!user) return null;
  // The User table doesn't yet carry lat/lon/tz — look up the cached
  // Location row by locationId from the user's kundali, falling back to
  // city name lookup. This ensures the client can rebuild the chart without
  // forcing the user back through the picker.
  const kundali = await Kundali.findOne({ where: { userId: user.id } });
  const loc = kundali?.locationId
    ? await Location.findByPk(kundali.locationId)
    : await Location.findOne({ where: { searchName: user.birthCity } });

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

// Resolve the User-row id for a phone (last-10-digit match, most-recently
// updated named profile) so it can be baked into the session JWT. Returns
// null when the phone has no profile yet (brand-new user) — the credit
// endpoint then falls back to a phone lookup.
async function userIdForPhone(phone) {
  const phoneMatch = phoneWhere(phone);
  if (!phoneMatch) return null;
  const user = await User.findOne({
    where: { phone: phoneMatch, name: { [Op.ne]: '' } },
    order: [['updatedAt', 'DESC']],
    attributes: ['id'],
  });
  return user ? user.id : null;
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

// Finish login for a verified (firebaseUid, phone) pair: upsert the account,
// ensure a User row, mint the session JWT, and hand back any saved birth form.
async function issueSession(firebaseUid, phone) {
  const account = await upsertAccount(firebaseUid, phone);
  // Register a placeholder User + signup credits on first login, so every
  // signup is tracked even before birth details are entered. Best-effort.
  await ensureUserForPhone(account.phone)
    .catch((err) => log.warn({ err: err.message }, 'ensureUserForPhone failed'));
  const token = signAppToken({
    accountId:   account.id,
    firebaseUid: account.firebaseUid,
    phone:       account.phone,
    userId:      await userIdForPhone(account.phone),
  });

  // Hand back any saved birth details so a returning user skips the form and
  // lands on their reading.
  const savedForm = await findSavedFormByPhone(account.phone);
  return { token, account: { id: account.id, phone: account.phone }, savedForm };
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

  return issueSession(decoded.uid, phone);
}

// OTP bypass: mint a session straight from a phone number, skipping Firebase.
// Allowed when NOT production (local dev always works, no config) OR when
// OTP_ENABLED==='false' is explicitly set — the latter lets you toggle the
// bypass on a LIVE deployment for testing. ⚠️ OTP_ENABLED='false' on a public
// URL means anyone can log in as any phone; flip it back to 'true' before real
// users. Clients opt in too via VITE_/EXPO_PUBLIC_OTP_ENABLED='false'. The phone
// is normalized to E.164; a synthetic stable firebaseUid keeps the row idempotent.
export async function bypassOtp(rawPhone) {
  const bypassAllowed = env.NODE_ENV !== 'production' || env.OTP_ENABLED === 'false';
  if (!bypassAllowed) {
    throw new AppError('otp_bypass_disabled', 403, 'OTP_BYPASS_DISABLED');
  }
  const digits = normalizePhone(rawPhone);
  if (!digits) throw new AppError('invalid_phone', 400, 'INVALID_PHONE');
  const phone = `+${digits}`;
  return issueSession(`bypass:${phone}`, phone);
}
