// Keys + indexes the live DB is missing (see the schema audit).
//
//  1. Users.createdAt        — the admin growth chart scans the table per load.
//  2. AuthAccounts.lastLoginAt — the daily re-engagement cron does the same.
//  3. Subscriptions.planId   — the association is declared in models/index.js
//                              but 0003 only emitted the userId FK.
//  4. Purchases.planId       — was CASCADE: deleting a plan would delete its
//                              purchase history. Financial rows must outlive
//                              the plan; that's what `active` soft-delete is for.
//
// FK surgery is MySQL-only here: sqlite (tests) can't ALTER a constraint without
// rebuilding the table, and the baseline sync() already emits the right FKs on a
// fresh DB, so there is nothing to fix there.

const INDEXES = [
  ['Users',        ['createdAt'],   'users_created_at'],
  ['AuthAccounts', ['lastLoginAt'], 'auth_accounts_last_login_at'],
];

async function hasIndex(q, table, name) {
  const idx = await q.showIndex(table).catch(() => []);
  return idx.some((i) => i.name === name);
}

// The auto-generated FK name differs per DB, so look it up rather than guess.
async function fkName(q, table, column) {
  const [rows] = await q.sequelize.query(
    `SELECT CONSTRAINT_NAME n FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
        AND REFERENCED_TABLE_NAME IS NOT NULL`,
    { replacements: [table, column] },
  );
  return rows[0]?.n ?? null;
}

export async function up({ context: q }) {
  for (const [table, fields, name] of INDEXES) {
    if (!(await hasIndex(q, table, name))) await q.addIndex(table, fields, { name });
  }

  if (q.sequelize.getDialect() !== 'mysql') return;

  // Purchases.planId: CASCADE → RESTRICT.
  const purchaseFk = await fkName(q, 'Purchases', 'planId');
  if (purchaseFk) await q.removeConstraint('Purchases', purchaseFk);
  await q.addConstraint('Purchases', {
    type: 'foreign key', name: 'purchases_plan_id_fk', fields: ['planId'],
    references: { table: 'CreditPlans', field: 'id' },
    onDelete: 'RESTRICT', onUpdate: 'CASCADE',
  });

  // Subscriptions.planId: no FK at all today.
  if (!(await fkName(q, 'Subscriptions', 'planId'))) {
    await q.addConstraint('Subscriptions', {
      type: 'foreign key', name: 'subscriptions_plan_id_fk', fields: ['planId'],
      references: { table: 'CreditPlans', field: 'id' },
      onDelete: 'RESTRICT', onUpdate: 'CASCADE',
    });
  }
}

export async function down({ context: q }) {
  for (const [table, , name] of INDEXES) await q.removeIndex(table, name);
  if (q.sequelize.getDialect() !== 'mysql') return;
  await q.removeConstraint('Subscriptions', 'subscriptions_plan_id_fk').catch(() => {});
  await q.removeConstraint('Purchases', 'purchases_plan_id_fk').catch(() => {});
}
