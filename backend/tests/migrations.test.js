import { describe, it, expect } from 'vitest';
import { umzug } from '../src/config/umzug.js';
import sequelize from '../src/config/dbConfig.js';
import { Setting } from '../src/models/index.js';
import { up as dailyFreeUp } from '../migrations/0001-daily-guidance-free.js';
import { up as phoneUniqueUp } from '../migrations/0005-phone-unique.js';
import { User } from '../src/models/index.js';

// The migration harness is the only thing standing between a schema change and
// production (server.js does NOT sync() in prod). If umzug can't find the
// baseline, or the baseline doesn't actually build the schema, every deploy
// ships a DB that's silently missing tables/columns.
describe('migrations', () => {
  it('baseline builds the schema, adds declared indexes, and re-runs clean', async () => {
    const pending = await umzug.pending();
    expect(pending.map((m) => m.name)).toContain('0000-baseline.js');

    await umzug.up();

    const tables = await sequelize.getQueryInterface().showAllTables();
    const lower = tables.map((t) => String(t).toLowerCase());
    for (const t of ['users', 'purchases', 'credittransactions', 'chatmessages']) {
      expect(lower).toContain(t);
    }

    // sync() backfills indexes declared on models after their table existed —
    // purchases_plan_id is the one the live DB was missing.
    const idx = await sequelize.getQueryInterface().showIndex('Purchases');
    expect(idx.map((i) => i.name)).toContain('purchases_plan_id');

    // 0004/0005 index work must land on top of the baseline, not be shadowed
    // by it — a missing one here means the admin dashboard scans Users.
    const users = (await sequelize.getQueryInterface().showIndex('Users')).map((i) => i.name);
    expect(users).toContain('users_created_at');
    expect(users).toContain('users_phone_unique');
    expect((await sequelize.getQueryInterface().showIndex('AuthAccounts')).map((i) => i.name))
      .toContain('auth_accounts_last_login_at');

    // Idempotent: nothing left pending, and a second up() is a no-op.
    expect(await umzug.pending()).toHaveLength(0);
    expect(await umzug.up()).toHaveLength(0);
  });

  it('0001 frees daily guidance but leaves a deliberate admin price alone', async () => {
    await Setting.bulkCreate([
      { key: 'daily_cost', value: '15' },       // still the old default
      { key: 'palm_cost',  value: '25' },       // admin-customised, must not move
    ]);

    await dailyFreeUp({ context: sequelize.getQueryInterface() });

    expect((await Setting.findByPk('daily_cost')).value).toBe('0');
    expect((await Setting.findByPk('palm_cost')).value).toBe('25');

    // A price an admin deliberately set is NOT the old default, so it survives.
    await Setting.update({ value: '7' }, { where: { key: 'daily_cost' } });
    await dailyFreeUp({ context: sequelize.getQueryInterface() });
    expect((await Setting.findByPk('daily_cost')).value).toBe('7');
  });

  it('0005 canonicalizes phones, and the UNIQUE blocks a split-credits fork', async () => {
    const form = {
      name: 'Dup', birthDate: '1990-01-01', birthTime: '10:00', birthCity: 'Pune',
    };
    await User.create({ ...form, phone: '919999900001', credits: 5 });

    // The bare-digit format is why phoneWhere() has to match IN ('+91…','91…').
    await phoneUniqueUp({ context: sequelize.getQueryInterface() });
    expect(await User.count({ where: { phone: '919999900001' } })).toBe(0);
    expect(await User.count({ where: { phone: '+919999900001' } })).toBe(1);

    // A second row on the same number is exactly the fork that split a user's
    // credits across two profiles. The constraint is what stops it.
    await expect(User.create({ ...form, phone: '+919999900001', credits: 7 }))
      .rejects.toThrow();
  });
});
