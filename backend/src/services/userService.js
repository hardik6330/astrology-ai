import { User } from '../models/index.js';
import { httpError } from '../middleware/errorHandler.js';

// Resolve a user by their birth-detail join key. Returns null if not found.
export async function findUserByForm({ name, date, time, city }) {
  if (!name || !date || !time || !city) {
    throw httpError(400, 'name, date, time and city are required', 'BAD_REQUEST');
  }
  return User.findOne({
    where: { name, birthDate: date, birthTime: time, birthCity: city },
  });
}

// Find-or-create — used by writers that must always have a User row.
export async function findOrCreateUser(form) {
  const [user] = await User.findOrCreate({
    where: {
      name: form.name,
      birthDate: form.date,
      birthTime: form.time,
      birthCity: form.city,
    },
    defaults: { gender: form.gender },
  });
  return user;
}
