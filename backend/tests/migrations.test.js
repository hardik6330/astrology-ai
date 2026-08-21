import { describe, it, expect } from 'vitest';
import { umzug } from '../src/config/umzug.js';
import sequelize from '../src/config/dbConfig.js';
import { Setting } from '../src/models/index.js';
import { up as dailyFreeUp } from '../migrations/0001-daily-guidance-free.js';

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
});
