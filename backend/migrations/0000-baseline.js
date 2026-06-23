// Baseline migration. up() runs sync() — non-destructive and idempotent, so it
// builds every table on a fresh DB and no-ops on an existing one (the prod DB
// already has every table from the old sync()-on-boot). This lets migration
// history start here without hand-writing createTable for the whole schema.
// See backend/MIGRATIONS.md ("baseline-and-forward").
import sequelize from '../src/config/dbConfig.js';
import '../src/models/index.js'; // register all models + associations before sync

export async function up() {
  await sequelize.sync();
}

export async function down() {
  // Irreversible by design — the baseline represents the entire schema.
  throw new Error('0000-baseline is not reversible');
}
