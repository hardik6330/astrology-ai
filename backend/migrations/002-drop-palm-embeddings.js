// Biometric palm matching was removed — the app is back to plain
// gate → Gemini → save. The PalmEmbeddings table (landmark/texture/line
// signatures used for the 1:N match) is now dead weight. sync() never drops
// tables, so existing DBs (local MySQL, Railway prod) keep the orphan until
// this runs. Idempotent: a DB that never had the table (fresh install) is a
// no-op. `down` is intentionally empty — we don't recreate a removed feature.

export async function up({ context: qi }) {
  const tables = await qi.showAllTables();
  const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t));
  if (names.includes('PalmEmbeddings')) {
    await qi.dropTable('PalmEmbeddings');
  }
}

export async function down() {
  /* no-op — the biometric feature was removed, not paused */
}
