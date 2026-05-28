import { User } from '../models/index.js';
import { httpError } from '../middleware/errorHandler.js';

// Resolve a user by their birth-detail join key. Returns null if not found.
export async function findUserByForm({ name, date, time, city, gender }) {
  if (!name || !date || !time || !city) {
    throw httpError(400, 'name, date, time and city are required', 'BAD_REQUEST');
  }
  return User.findOne({
    where: { name, birthDate: date, birthTime: time, birthCity: city, gender: gender || null },
  });
}

// Find-or-create — used by writers that must always have a User row.
// If the form carries a phone (set after dummy OTP login on the client),
// stamp it onto the row — both on first create and any later update.
export async function findOrCreateUser(form) {
  const [user] = await User.findOrCreate({
    where: {
      name: form.name,
      birthDate: form.date,
      birthTime: form.time,
      birthCity: form.city,
      gender: form.gender || null,
    },
    defaults: { phone: form.phone || null },
  });
  if (form.phone && user.phone !== form.phone) {
    await user.update({ phone: form.phone });
  }
  return user;
}
