// Baseline migration — the first entry in the schema's history.
//
// Both live DBs were built by the old `sync()`-on-boot, so hand-writing 14
// createTable migrations would be pure risk for zero gain. Instead the baseline
// IS a sync(): non-destructive and idempotent, so it builds everything on a
// fresh DB and no-ops on an existing one. Sequelize's sync() also creates any
// declared index that's missing from an existing table (Model.sync diffs
// showIndex against _indexes), which is how the live DBs pick up the indexes
// added to the models after their tables were first created — purchases_plan_id
// among them. That's why there's no separate add-indexes migration.
//
// Everything AFTER this file is a real forward migration (addColumn etc.);
// sync() can't alter existing tables, so it can never be the answer again.

export async function up({ context: q }) {
  // Registers all models + associations so sync() sees the full schema.
  await import('../src/models/index.js');
  await q.sequelize.sync();
}

export async function down() {
  // Deliberately a no-op. Rolling "back" a baseline means dropping every table
  // and all production data; if that is genuinely what you want, do it by hand.
  throw new Error('0000-baseline is not reversible — it is the start of history.');
}
