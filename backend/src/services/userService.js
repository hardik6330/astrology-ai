import { Op } from 'sequelize';
import { User, Kundali, DailyData } from '../models/index.js';
import { httpError } from '../middleware/errorHandler.js';
import { notifyWelcome } from './pushService.js';
import { grant } from './creditService.js';
import * as settings from './settingsService.js';
import { logger } from '../config/logger.js';

const log = logger.child({ mod: 'user' });

// Resolve a user by their birth-detail join key — scoped by phone when the
// caller is authenticated. Two accounts on different phone numbers sharing
// the exact same birth data MUST resolve to different User rows so they
// don't inherit each other's kundali/palm/chat history. Returns null if
// not found.
export async function findUserByForm({ name, date, time, city, gender, phone }) {
  if (!name || !date || !time || !city) {
    throw httpError(400, 'name, date, time and city are required', 'BAD_REQUEST');
  }
  const where = {
    name,
    birthDate: date,
    birthTime: time,
    birthCity: city,
    gender: gender || null,
  };
  // Only scope by phone when the client passed one — unauthenticated calls
  // (rare; legacy paths) keep the old name+birth-only lookup.
  if (phone) where.phone = phone;
  return User.findOne({ where });
}

// Resolve the User behind a logged-in token, by phone alone. Matches on the
// last 10 digits so a token phone of "+918525361245" finds a row stored as
// "8525361245" (and vice-versa). When a phone has several profiles we return
// the most recently saved named one — the active chart whose balance the
// credit badge should reflect. Returns null if the phone has no profile yet.
export async function findUserByPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) return null;
  return User.findOne({
    where: { phone: { [Op.like]: `%${digits}` }, name: { [Op.ne]: '' } },
    order: [['updatedAt', 'DESC']],
  });
}

// Find-or-create — used by writers that must always have a User row.
//
// Identity is the PHONE, not the birth data: a logged-in person is ONE User.
// So editing birth details (Update Profile) updates that same row in place —
// credits and history stay put instead of forking a brand-new user. Only a
// genuinely different phone creates a new User. Calls without a phone (legacy
// / anonymous) fall back to keying on the birth data itself.
export async function findOrCreateUser(form) {
  const birth = {
    name: form.name,
    birthDate: form.date,
    birthTime: form.time,
    birthCity: form.city,
    gender: form.gender || null,
  };

  // ── Anonymous / legacy path: no phone → key on birth data (old behaviour) ──
  if (!form.phone) {
    const [user, created] = await User.findOrCreate({
      where: birth,
      defaults: { phone: null, credits: 0 },
    });
    if (created) await grantSignupBonus(user, null);
    return user;
  }

  // ── Authenticated path: phone is the identity ──
  const existing = await findUserByPhoneAny(form.phone);
  if (existing) {
    // Re-point this row at the (possibly edited) birth details. If the chart
    // actually changed, drop the cached AI readings so they regenerate for
    // the new chart instead of showing the previous chart's interpretation.
    const chartChanged =
      existing.birthDate !== birth.birthDate ||
      existing.birthTime !== birth.birthTime ||
      existing.birthCity !== birth.birthCity ||
      existing.name !== birth.name;
    await existing.update(birth);
    if (chartChanged) {
      await Promise.all([
        Kundali.destroy({ where: { userId: existing.id } }),
        DailyData.destroy({ where: { userId: existing.id } }),
      ]).catch((err) => log.warn({ err: err.message }, 'stale reading cleanup failed'));
    }
    return existing;
  }

  // First profile for this phone → create + welcome bonus.
  const user = await User.create({ ...birth, phone: form.phone, credits: 0 });
  await grantSignupBonus(user, form.phone);
  return user;
}

// Look up an existing User for a phone, last-10-digit match, most-recently
// updated first. Unlike findUserByPhone() this does NOT require a name, so it
// also catches placeholder rows created before birth details were entered.
async function findUserByPhoneAny(phone) {
  const digits = String(phone || '').replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) return null;
  return User.findOne({
    where: { phone: { [Op.like]: `%${digits}` } },
    order: [['updatedAt', 'DESC']],
  });
}

// Welcome bonus + onboarding push, both granted ONCE when a User is first
// created. Fire-and-forget so neither can break user creation.
async function grantSignupBonus(user, phone) {
  const bonus = await settings.getNumber('initial_credits', 200);
  await grant({ userId: user.id, amount: bonus, reason: 'signup_bonus' })
    .catch((err) => log.warn({ err: err.message }, 'signup bonus grant failed'));
  notifyWelcome(phone || user.phone)
    .catch((err) => log.warn({ err: err.message }, 'welcome push failed'));
}
