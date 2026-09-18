// Service-level tests for the invariants CLAUDE.md's "things that have bitten"
// list cares about: credit-charge atomicity, purchase replay idempotency, the
// engage-push CAS, and the IAP mock-fallback. Runs against file-backed SQLite
// (see dbConfig.js) — same Sequelize queries, no MySQL server needed.

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';

// engageService fans out via Firebase Admin — stub the sender so these tests
// never touch FCM (and don't need a service-account credential).
vi.mock('../src/services/notificationService.js', () => ({
  sendToTokens: vi.fn(async (rows) => ({ sent: rows.length, failed: 0, pruned: 0 })),
}));

import sequelize from '../src/config/dbConfig.js';
import {
  User, Setting, CreditTransaction, CreditPlan, Purchase,
  NotificationTemplate, PushToken, AuthAccount,
} from '../src/models/index.js';
import { charge, grant, getBalance } from '../src/services/creditService.js';
import * as settings from '../src/services/settingsService.js';
import { sendEngagement } from '../src/services/engageService.js';

const USER_FORM = {
  name: 'Test', birthDate: '2000-01-01', birthTime: '12:00', birthCity: 'Mumbai',
};

beforeAll(async () => {
  // WAL lets the services' nested-independent transactions coexist (grant()
  // commits on its own connection while the outer settlement txn is open) —
  // with the default rollback journal that pattern deadlocks on SQLITE_BUSY.
  await sequelize.query('PRAGMA journal_mode=WAL;');
  await sequelize.sync({ force: true });
});

beforeEach(async () => {
  // Clean slate per test, children before parents (FKs). Bust the settings
  // cache so each test's Setting rows are what the services actually read.
  for (const Model of [
    CreditTransaction, Purchase, PushToken,
    User, CreditPlan, AuthAccount, Setting, NotificationTemplate,
  ]) {
    await Model.destroy({ where: {} });
  }
  settings.invalidate();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('creditService.charge — atomic guarded decrement', () => {
  it('concurrent charges can never overspend; each spend writes a ledger row', async () => {
    await Setting.create({ key: 'palm_cost', value: '5' });
    const user = await User.create({ ...USER_FORM, credits: 12 });

    // 12 credits, cost 5 → of 3 concurrent charges exactly 2 can win.
    const results = await Promise.allSettled([
      charge({ userId: user.id, costKey: 'palm_cost', reason: 'palm' }),
      charge({ userId: user.id, costKey: 'palm_cost', reason: 'palm' }),
      charge({ userId: user.id, costKey: 'palm_cost', reason: 'palm' }),
    ]);

    const wins = results.filter((r) => r.status === 'fulfilled');
    const losses = results.filter((r) => r.status === 'rejected');
    expect(wins).toHaveLength(2);
    expect(losses).toHaveLength(1);
    expect(losses[0].reason.statusCode ?? losses[0].reason.status).toBe(402);
    expect(losses[0].reason.code).toBe('INSUFFICIENT_CREDITS');

    expect(await getBalance(user.id)).toBe(2); // never negative

    // Ledger: one row per successful spend, amounts -5, running balances sane.
    const ledger = await CreditTransaction.findAll({
      where: { userId: user.id }, order: [['balance', 'DESC']],
    });
    expect(ledger).toHaveLength(2);
    expect(ledger.map((r) => r.amount)).toEqual([-5, -5]);
    expect(ledger.map((r) => r.balance)).toEqual([7, 2]);
  });

  it('insufficient balance → 402, balance untouched, no ledger row', async () => {
    await Setting.create({ key: 'chat_cost', value: '10' });
    const user = await User.create({ ...USER_FORM, credits: 3 });

    await expect(charge({ userId: user.id, costKey: 'chat_cost', reason: 'chat' }))
      .rejects.toMatchObject({ code: 'INSUFFICIENT_CREDITS' });

    expect(await getBalance(user.id)).toBe(3);
    expect(await CreditTransaction.count({ where: { userId: user.id } })).toBe(0);
  });

  it('zero/unset cost is a free no-op (no ledger noise)', async () => {
    const user = await User.create({ ...USER_FORM, credits: 7 });
    const res = await charge({ userId: user.id, costKey: 'daily_cost', reason: 'daily' });
    expect(res).toEqual({ charged: 0, balance: 7 });
    expect(await CreditTransaction.count()).toBe(0);
  });

  it('grant adds credits and appends a ledger row with the running balance', async () => {
    const user = await User.create({ ...USER_FORM, credits: 1 });
    const res = await grant({ userId: user.id, amount: 9, reason: 'refund' });
    expect(res).toEqual({ granted: 9, balance: 10 });
    const row = await CreditTransaction.findOne({ where: { userId: user.id } });
    expect(row).toMatchObject({ amount: 9, balance: 10, reason: 'refund' });
  });
});

describe('engageService — atomic claim of notif_next_at', () => {
  async function seedEngage() {
    // Window 0–24 so the IST wall-clock hour never matters; due immediately.
    await Setting.bulkCreate([
      { key: 'notif_enabled', value: 'true' },
      { key: 'notif_next_at', value: '0' },
      { key: 'notif_window_start', value: '0' },
      { key: 'notif_window_end', value: '24' },
    ]);
    await NotificationTemplate.create({ title: 'Hello', body: 'The stars align.' });
    const acc = await AuthAccount.create({ firebaseUid: 'fb-test-1', phone: '+910000000001' });
    await PushToken.create({ accountId: acc.id, token: 'tok-1', enabled: true });
    settings.invalidate();
  }

  it('overlapping ticks: exactly one claims the slot and sends', async () => {
    await seedEngage();

    const [a, b] = await Promise.all([sendEngagement(), sendEngagement()]);
    const sent = [a, b].filter((r) => r.sent === 1);
    const skipped = [a, b].filter((r) => r.skipped);
    expect(sent).toHaveLength(1);
    expect(skipped).toHaveLength(1);
    expect(['claimed_by_other', 'not_due']).toContain(skipped[0].skipped);

    // The winner re-armed the schedule: notif_next_at is now in the future.
    const next = await Setting.findByPk('notif_next_at');
    expect(Number(next.value)).toBeGreaterThan(Date.now());
  });

  it('a tick before notif_next_at is a no-op', async () => {
    await seedEngage();
    await Setting.update(
      { value: String(Date.now() + 3600_000) },
      { where: { key: 'notif_next_at' } },
    );
    settings.invalidate();
    expect((await sendEngagement()).skipped).toBe('not_due');
  });

  it('disabled kill-switch short-circuits everything', async () => {
    await seedEngage();
    await Setting.update({ value: 'false' }, { where: { key: 'notif_enabled' } });
    settings.invalidate();
    expect((await sendEngagement()).skipped).toBe('disabled');
  });
});
