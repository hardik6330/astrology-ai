// Baseline migration — the first entry in the schema's history.
//
// Both live DBs were built by the old `sync()`-on-boot, so hand-writing 14
// createTable migrations would be pure risk for zero gain. Instead the baseline
// IS a sync(): non-destructive and idempotent, so it builds everything on a
// fresh DB and no-ops on an existing one. Sequelize's sync() also creates any
// declared index that's missing from an existing table (Model.sync diffs
// showIndex against _indexes), which is how the live DBs pick up the indexes
// added to the models after their tables were first created.
//
// Everything AFTER this file is a real forward migration (addColumn etc.);
// sync() can't alter existing tables, so it can never be the answer again.

// ...except for columns added to a model BEFORE this baseline existed, which is
// the one case sync() cannot heal and every later migration is too late to fix.
// A table built by the old boot-sync is frozen at whatever the model looked like
// then, so `Kundalis.chartHash` / `DailyData.chartHash` never landed — and
// sync() would abort trying to build `kundalis_user_charthash` on a column that
// doesn't exist, taking the whole baseline down with it. So: add missing columns
// first, then sync.
//
// Deliberately additive only — never alters or drops. A column the model
// declares NOT NULL with no default can't be added to a table that already has
// rows, so those are reported rather than forced; that needs a real migration
// with a backfill.
async function addMissingColumns(q) {
  const { default: sequelize } = await import('../src/config/dbConfig.js');
  for (const model of Object.values(sequelize.models)) {
    let live;
    try { live = await q.describeTable(model.tableName); } catch { continue; } // fresh DB — sync() builds it
    for (const [name, attr] of Object.entries(model.rawAttributes)) {
      const col = attr.field || name;
      if (live[col]) continue;
      if (attr.allowNull === false && attr.defaultValue === undefined) {
        console.warn(`[baseline] ${model.tableName}.${col} is missing and NOT NULL with no default — needs a migration with a backfill`);
        continue;
      }
      await q.addColumn(model.tableName, col, attr);
      console.log(`[baseline] added missing column ${model.tableName}.${col}`);
    }
  }
}

// Second pre-baseline heal. dbConfig pins `utf8mb4_unicode_ci` specifically so
// PK and FK columns share a collation — MySQL silently refuses a FOREIGN KEY
// when they differ. But every table built by the old boot-sync predates that pin
// and is still `utf8mb4_general_ci`, so sync() cannot create ChartMemories or
// Subscriptions at all: their FK to AuthAccounts/Users fails with errno 150,
// "Foreign key constraint is incorrectly formed".
//
// So: build new tables in the collation this database ALREADY uses. What the pin
// is actually for is CONSISTENCY between PK and FK columns, and adopting the
// incumbent collation satisfies that just as well as converting to the pinned
// one — without touching a single existing table.
//
// Converting instead was the first attempt and is a dead end for an automatic
// step: MariaDB rejects a collation change on any column an FK references
// (ER_FK_COLUMN_CANNOT_CHANGE_CHILD, 1833) and FOREIGN_KEY_CHECKS=0 does NOT
// waive it — verified. You'd have to drop every FK, convert 14 tables, and
// rebuild them, which is a deliberate maintenance window, not something a
// baseline should do to production behind your back.
//
// A fresh database has no tables, so it keeps the pinned utf8mb4_unicode_ci.
async function adoptExistingCollation(q) {
  if (q.sequelize.getDialect() !== 'mysql') return;
  const [rows] = await q.sequelize.query(
    `SELECT TABLE_COLLATION c, COUNT(*) n FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
        AND TABLE_NAME <> 'SequelizeMeta' AND TABLE_COLLATION IS NOT NULL
      GROUP BY TABLE_COLLATION ORDER BY n DESC LIMIT 1`,
  );
  const incumbent = rows[0]?.c;
  if (!incumbent || incumbent === q.sequelize.options.define.collate) return;
  q.sequelize.options.define.collate = incumbent;
  console.warn(`[baseline] existing tables are ${incumbent}; new tables will match so FKs form. `
    + 'Converting the whole DB to utf8mb4_unicode_ci is a separate, deliberate migration.');
}

export async function up({ context: q }) {
  // Order matters: a model snapshots sequelize.options.define when it is
  // defined, so the collation has to be settled BEFORE the models are imported.
  await adoptExistingCollation(q);
  // Registers all models + associations so sync() sees the full schema.
  await import('../src/models/index.js');
  await addMissingColumns(q);
  await q.sequelize.sync();
}

export async function down() {
  // Deliberately a no-op. Rolling "back" a baseline means dropping every table
  // and all production data; if that is genuinely what you want, do it by hand.
  throw new Error('0000-baseline is not reversible — it is the start of history.');
}
