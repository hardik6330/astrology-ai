import { findUserByPhone } from '../services/userService.js';
import { getBalance } from '../services/creditService.js';
import * as settings from '../services/settingsService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// GET /credits → { credits, costs }. The user is resolved from the auth token
// (req.auth.phone) — no form/query params needed. `credits` is that user's
// balance (or a preview of the welcome bonus if they have no profile yet).
// `costs` lets the clients label "Unlock for N credits" buttons / cost
// reminders without hardcoding prices.
export const getCredits = asyncHandler(async (req, res) => {
  const [insights, chat, daily, palm] = await Promise.all([
    settings.getNumber('insights_cost', 20),
    settings.getNumber('chat_cost', 5),
    settings.getNumber('daily_cost', 15),
    settings.getNumber('palm_cost', 30),
  ]);
  const costs = { insights, chat, daily, palm };

  res.locals.message = 'Credits fetched';

  // Prefer the userId baked into the JWT — a direct, stable balance lookup.
  // Fall back to a phone lookup for tokens issued before userId existed, or
  // for users who logged in before creating their first profile.
  let credits = null;
  if (req.auth?.userId) credits = await getBalance(req.auth.userId);
  if (credits == null) {
    const user = await findUserByPhone(req.auth?.phone);
    if (user) credits = await getBalance(user.id);
  }
  if (credits != null) return res.json({ credits, costs });

  const initial = await settings.getNumber('initial_credits', 200);
  res.json({ credits: initial, costs });
});
