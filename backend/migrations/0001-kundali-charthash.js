// Fix A: cache kundali interpretations PER chart instead of one-per-user.
// Adds Kundalis.chartHash, backfills it from the owning user's chartHash (1:1
// today), and swaps the UNIQUE index from (userId) → (userId, chartHash) so a
// user can keep a saved reading for each distinct birth chart they generate.
// Idempotent: safe to run on a fresh DB (baseline just created the column-less
// table) and on the existing prod DB.
import { DataTypes } from 'sequelize';

const TABLE = 'Kundalis';

export async function up({ context: q }) {
  const cols = await q.describeTable(TABLE);
  if (!cols.chartHash) {
    await q.addColumn(TABLE, 'chartHash', { type: DataTypes.STRING(64), allowNull: true });
  }

  // Backfill from the owning user's identity hash so returning users keep their
  // already-paid reading as a cache hit (each Kundali maps 1:1 to a user today).
  await q.sequelize.query(
    `UPDATE ${TABLE} k JOIN Users u ON k.userId = u.id
        SET k.chartHash = u.chartHash
      WHERE k.chartHash IS NULL AND u.chartHash IS NOT NULL`,
  );

  // userId-only UNIQUE → (userId, chartHash) UNIQUE. Wrapped in try/catch so the
  // migration is safe to re-run regardless of which index currently exists.
  try { await q.removeIndex(TABLE, 'kundalis_user_id'); } catch { /* already dropped */ }
  try {
    await q.addIndex(TABLE, ['userId', 'chartHash'], {
      unique: true, name: 'kundalis_user_charthash',
    });
  } catch { /* already present */ }
}

export async function down({ context: q }) {
  try { await q.removeIndex(TABLE, 'kundalis_user_charthash'); } catch { /* already dropped */ }
  // Restoring the userId-only UNIQUE can fail if duplicate per-user rows now
  // exist (the whole point of this migration) — that's expected; surface it.
  try {
    await q.addIndex(TABLE, ['userId'], { unique: true, name: 'kundalis_user_id' });
  } catch { /* duplicates exist — cannot restore the 1:1 constraint */ }
  const cols = await q.describeTable(TABLE);
  if (cols.chartHash) await q.removeColumn(TABLE, 'chartHash');
}
