// Fix A (daily): cache DailyData PER chart, mirroring 0001 for kundalis.
// Adds DailyData.chartHash, backfills it from the owning user's chartHash, and
// swaps the UNIQUE index from (userId, date) → (userId, date, chartHash) so a
// user keeps each chart's saved days and re-views them free after editing
// birth details. Idempotent — safe to re-run on fresh and existing DBs.
import { DataTypes } from 'sequelize';

const TABLE = 'DailyData';

export async function up({ context: q }) {
  const cols = await q.describeTable(TABLE);
  if (!cols.chartHash) {
    await q.addColumn(TABLE, 'chartHash', { type: DataTypes.STRING(64), allowNull: true });
  }

  // Backfill from the owning user's identity hash (each row's prior chart).
  await q.sequelize.query(
    `UPDATE ${TABLE} d JOIN Users u ON d.userId = u.id
        SET d.chartHash = u.chartHash
      WHERE d.chartHash IS NULL AND u.chartHash IS NOT NULL`,
  );

  // (userId, date) UNIQUE → (userId, date, chartHash) UNIQUE.
  try { await q.removeIndex(TABLE, 'daily_data_user_date'); } catch { /* already dropped */ }
  try {
    await q.addIndex(TABLE, ['userId', 'date', 'chartHash'], {
      unique: true, name: 'daily_data_user_date_chart',
    });
  } catch { /* already present */ }
}

export async function down({ context: q }) {
  try { await q.removeIndex(TABLE, 'daily_data_user_date_chart'); } catch { /* already dropped */ }
  // Restoring the (userId, date) UNIQUE can fail if multiple charts now share a
  // (user, date) — expected after this migration; surface only if clean.
  try {
    await q.addIndex(TABLE, ['userId', 'date'], { unique: true, name: 'daily_data_user_date' });
  } catch { /* per-chart rows exist — cannot restore the old constraint */ }
  const cols = await q.describeTable(TABLE);
  if (cols.chartHash) await q.removeColumn(TABLE, 'chartHash');
}
