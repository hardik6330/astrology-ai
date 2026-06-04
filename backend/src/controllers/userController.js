import { findOrCreateUser } from '../services/userService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// POST /profile — persist the birth-detail form onto the logged-in user's row
// the moment it's entered, before any reading is generated. No credit charge:
// findOrCreateUser just fills in (or updates) the login placeholder in place.
//
// Identity comes from the TOKEN's phone, not the body, so a client can't write
// birth data into another phone's user row.
export const saveProfile = asyncHandler(async (req, res) => {
  const form = { ...req.body.form, phone: req.auth?.phone || req.body.form.phone };
  const user = await findOrCreateUser(form);
  res.json({ user: { id: user.id, name: user.name, credits: user.credits } });
});
