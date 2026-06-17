// Regression test for the C1 IDOR fix: user-data lookups must be scoped to the
// caller's OWN phone (taken from the verified token, see utils/authForm.js), and
// must NEVER fall back to a name+birth-only match — otherwise an authed caller
// could read another person's kundali/palm/chat/daily by submitting that
// person's birth details. Tests findUserByForm directly, the single chokepoint
// every GET content endpoint resolves through.

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

// userService → pushService → notificationService fans out via Firebase Admin;
// stub it so the import doesn't need a service-account credential.
vi.mock('../src/services/notificationService.js', () => ({
  sendToTokens: vi.fn(async (rows) => ({ sent: rows.length, failed: 0, pruned: 0 })),
}));

import sequelize from '../src/config/dbConfig.js';
import { User, CreditTransaction, AuthAccount } from '../src/models/index.js';
import { findUserByForm } from '../src/services/userService.js';

const BIRTH = {
  name: 'Victim', birthDate: '1990-05-05', birthTime: '08:30', birthCity: 'Delhi',
};

beforeAll(async () => {
  await sequelize.query('PRAGMA journal_mode=WAL;');
  await sequelize.sync({ force: true });
});

beforeEach(async () => {
  for (const Model of [CreditTransaction, User, AuthAccount]) {
    await Model.destroy({ where: {} });
  }
});

describe('findUserByForm — caller-phone scoping (C1 IDOR)', () => {
  it('returns the row for the owner, matching E.164 stored ↔ bare-digit token and vice-versa', async () => {
    // Real-OTP rows are stored in E.164 (with the leading '+').
    const victim = await User.create({ ...BIRTH, phone: '+919876543210', credits: 99 });
    const find = (phone) => findUserByForm({
      name: BIRTH.name, date: BIRTH.birthDate, time: BIRTH.birthTime, city: BIRTH.birthCity, phone,
    });

    expect((await find('+919876543210'))?.id).toBe(victim.id); // E.164 token
    expect((await find('919876543210'))?.id).toBe(victim.id);  // bare-digit token
  });

  it("does NOT return another user's row when the attacker sends the victim's birth data with a different phone", async () => {
    await User.create({ ...BIRTH, phone: '+919876543210', credits: 99 });

    const found = await findUserByForm({
      name: BIRTH.name, date: BIRTH.birthDate, time: BIRTH.birthTime, city: BIRTH.birthCity,
      phone: '+911111111111',
    });
    expect(found).toBeNull();
  });

  it('does NOT collide across countries that share the same trailing 10 digits', async () => {
    // India "+91 98765 43210" and a number "+1 98765 43210" share the last 10
    // digits. The old slice(-10) rule would have matched them — full-number
    // matching must not.
    await User.create({ ...BIRTH, phone: '+919876543210', credits: 99 });

    const found = await findUserByForm({
      name: BIRTH.name, date: BIRTH.birthDate, time: BIRTH.birthTime, city: BIRTH.birthCity,
      phone: '+19876543210',
    });
    expect(found).toBeNull();
  });

  it('returns null when no phone is supplied (no name+birth-only fallback)', async () => {
    await User.create({ ...BIRTH, phone: '+919876543210', credits: 99 });

    const found = await findUserByForm({
      name: BIRTH.name, date: BIRTH.birthDate, time: BIRTH.birthTime, city: BIRTH.birthCity,
      // phone omitted — the old code would have matched on birth data alone.
    });
    expect(found).toBeNull();
  });
});
