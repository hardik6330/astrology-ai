import { User } from '../models/index.js';
import { httpError } from '../middleware/errorHandler.js';

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

// Find-or-create — used by writers that must always have a User row.
// When `phone` is present, it's part of the identity key: a new phone with
// the same birth data creates a fresh User instead of taking over the
// existing one. We NEVER overwrite an existing row's phone on match,
// because that would silently re-assign the original user's data.
export async function findOrCreateUser(form) {
  const where = {
    name: form.name,
    birthDate: form.date,
    birthTime: form.time,
    birthCity: form.city,
    gender: form.gender || null,
  };
  if (form.phone) where.phone = form.phone;
  const [user] = await User.findOrCreate({
    where,
    defaults: { phone: form.phone || null },
  });
  return user;
}
