// Daily guidance becomes free.
//
// Metering the daily reading metered the only daily habit in the product —
// users rationed the exact behaviour that drives retention. Depth stays paid
// (kundali reading, chat, palm); frequency does not.
//
// Settings live in the DB and are admin-editable, so the seed default alone
// can't change an existing install. This flips the stored value — but ONLY when
// it's still the old default of '15', so a deliberate admin price survives.

const OLD_DEFAULT = '15';

// bulkUpdate, not raw SQL: it quotes `key` (reserved in MySQL) and stays
// dialect-agnostic, so this runs on sqlite in tests as well as MySQL in prod.
// A raw NOW() would not — tests/migrations.test.js is what caught that.
// updatedAt is deliberately left alone: bulkUpdate doesn't manage timestamps,
// and hand-setting a Date trips sqlite's date parser. Nothing reads it.
export async function up({ context: q }) {
  await q.bulkUpdate('Settings',
    { value: '0' },
    { key: 'daily_cost', value: OLD_DEFAULT });
}

export async function down({ context: q }) {
  await q.bulkUpdate('Settings',
    { value: OLD_DEFAULT },
    { key: 'daily_cost', value: '0' });
}
