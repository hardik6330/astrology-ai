// Phone-OTP auth endpoints. The actual OTP delivery + verification is done
// by Firebase on the client; we only see the resulting Firebase ID token,
// verify it server-side with firebase-admin, then mint our own JWT.

import { Router } from 'express';
import { z } from 'zod';
import { verifyIdToken } from '../config/firebase.js';
import { AuthAccount, User } from '../models/index.js';
import { requireAuth, signAppToken } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { logger } from '../config/logger.js';

// Look up the most recently saved User row for this phone so a returning
// user can skip the birth-details form and land straight on their kundali.
async function findSavedFormByPhone(phone) {
  if (!phone) return null;
  const user = await User.findOne({
    where: { phone },
    order: [['updatedAt', 'DESC']],
  });
  if (!user) return null;
  return {
    name:   user.name,
    gender: user.gender || '',
    date:   user.birthDate,
    time:   user.birthTime,
    city:   user.birthCity,
  };
}

const router = Router();

const verifyBody = z.object({
  idToken: z.string().min(20),
});

router.post('/auth/verify-otp', writeLimiter, validate(verifyBody, 'body'), async (req, res) => {
  const { idToken } = req.body;

  // 1. Verify the Firebase ID token. This throws if expired/forged.
  let decoded;
  try {
    decoded = await verifyIdToken(idToken);
  } catch (err) {
    logger.warn({ err: err.message }, 'Firebase token verification failed');
    return res.status(401).json({ error: 'invalid_id_token' });
  }

  const firebaseUid = decoded.uid;
  const phone = decoded.phone_number || null;
  if (!phone) return res.status(400).json({ error: 'no_phone_in_token' });

  // 2. Upsert auth ledger.
  const [account] = await AuthAccount.findOrCreate({
    where: { firebaseUid },
    defaults: { firebaseUid, phone, lastLoginAt: new Date() },
  });
  await account.update({ phone, lastLoginAt: new Date() });

  // 3. Mint our own session JWT.
  const token = signAppToken({
    accountId:   account.id,
    firebaseUid: account.firebaseUid,
    phone:       account.phone,
  });

  res.json({
    token,
    account: { id: account.id, phone: account.phone },
  });
});

router.get('/auth/me', requireAuth, (req, res) => {
  res.json({ account: req.auth });
});

// Dummy login — accepts a phone number, findOrCreates an AuthAccount,
// returns a real session JWT. Used while real Firebase Phone Auth isn't
// wired up on the client. Replace usage with /auth/verify-otp once it is.
const dummyBody = z.object({
  phone: z.string().min(10).max(20),
});

router.post('/auth/dummy-login', writeLimiter, validate(dummyBody, 'body'), async (req, res) => {
  // Normalise to the canonical 10-digit local number — strips +91, spaces,
  // dashes, leading zeros, etc. Old rows that were saved as "+919876543210"
  // and new clients sending "9876543210" both resolve to the same UID.
  const digits = req.body.phone.replace(/[^\d]/g, '').slice(-10);
  if (digits.length !== 10) {
    return res.status(400).json({ error: 'invalid_phone' });
  }
  const phone = digits;
  // Use a synthetic firebaseUid keyed on phone so dummy and real Firebase
  // accounts can't collide. Firebase UIDs are 28 chars of alphanumerics;
  // ours are prefixed `dummy_` and clearly distinguishable.
  const firebaseUid = `dummy_${digits}`;

  const [account] = await AuthAccount.findOrCreate({
    where: { firebaseUid },
    defaults: { firebaseUid, phone, lastLoginAt: new Date() },
  });
  await account.update({ phone, lastLoginAt: new Date() });

  const token = signAppToken({
    accountId:   account.id,
    firebaseUid: account.firebaseUid,
    phone:       account.phone,
  });

  // If this phone already has saved birth details, send them back so
  // the client can skip the home form and jump straight to Reading.
  const savedForm = await findSavedFormByPhone(phone);

  logger.info({ phone, accountId: account.id, returning: !!savedForm }, 'dummy login');
  res.json({
    token,
    account: { id: account.id, phone: account.phone },
    savedForm,
  });
});

export default router;
