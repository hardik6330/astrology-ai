// Cosmic Credits ledger operations. Every balance change goes through here so
// it's atomic (no double-spend under concurrent requests) and recorded in the
// CreditTransaction ledger in the SAME transaction as the balance update.
//
// Prices are read live from settingsService, so changing a cost in the admin
// panel takes effect on the next charge (within the settings cache TTL).

import { Op, literal } from 'sequelize';
import sequelize from '../config/dbConfig.js';
import { User, CreditTransaction } from '../models/index.js';
import * as settings from './settingsService.js';
import { httpError } from '../middleware/errorHandler.js';

// Charge a user the price stored under `costKey` (e.g. 'chat_cost').
//
// The deduction is a single guarded UPDATE — `credits = credits - cost WHERE
// credits >= cost` — so two near-simultaneous requests can't both pass the
// check and overspend; at most one wins, the other sees 0 rows affected and is
// rejected. The matching ledger row is written in the same transaction.
//
// Returns { charged, balance }. A zero/disabled price is a no-op.
// Throws 402 INSUFFICIENT_CREDITS when the balance can't cover the cost.
export async function charge({ userId, costKey, reason, meta = null }) {
  const cost = Math.max(0, Math.round(await settings.getNumber(costKey, 0)));

  // Free / disabled feature — nothing to deduct, no ledger noise.
  if (cost === 0) {
    const u = await User.findByPk(userId, { attributes: ['credits'] });
    if (!u) throw httpError(404, 'User not found', 'NOT_FOUND');
    return { charged: 0, balance: u.credits };
  }

  return sequelize.transaction(async (t) => {
    // Atomic guarded decrement. affectedCount is 0 if the user is missing OR
    // the balance is below `cost` — the WHERE clause enforces both.
    const [affected] = await User.update(
      { credits: literal(`credits - ${cost}`) },
      { where: { id: userId, credits: { [Op.gte]: cost } }, transaction: t },
    );

    if (affected === 0) {
      const exists = await User.findByPk(userId, { attributes: ['id'], transaction: t });
      if (!exists) throw httpError(404, 'User not found', 'NOT_FOUND');
      throw httpError(402, 'Not enough credits', 'INSUFFICIENT_CREDITS');
    }

    const user = await User.findByPk(userId, { attributes: ['credits'], transaction: t });
    await CreditTransaction.create(
      { userId, amount: -cost, balance: user.credits, reason, meta },
      { transaction: t },
    );
    return { charged: cost, balance: user.credits };
  });
}

// Add credits (signup bonus, admin grant, future top-ups). Same atomic
// pattern + ledger row. Returns { granted, balance }.
export async function grant({ userId, amount, reason, meta = null }) {
  const amt = Math.max(0, Math.round(Number(amount) || 0));
  if (amt === 0) {
    const u = await User.findByPk(userId, { attributes: ['credits'] });
    if (!u) throw httpError(404, 'User not found', 'NOT_FOUND');
    return { granted: 0, balance: u.credits };
  }

  return sequelize.transaction(async (t) => {
    const [affected] = await User.update(
      { credits: literal(`credits + ${amt}`) },
      { where: { id: userId }, transaction: t },
    );
    if (affected === 0) throw httpError(404, 'User not found', 'NOT_FOUND');

    const user = await User.findByPk(userId, { attributes: ['credits'], transaction: t });
    await CreditTransaction.create(
      { userId, amount: amt, balance: user.credits, reason, meta },
      { transaction: t },
    );
    return { granted: amt, balance: user.credits };
  });
}

// Current balance for a user (null if the user doesn't exist).
export async function getBalance(userId) {
  const u = await User.findByPk(userId, { attributes: ['credits'] });
  return u ? u.credits : null;
}
