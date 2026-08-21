// Users.phone is the identity — every request resolves through it — but nothing
// stopped two rows sharing one. Two concurrent findOrCreateUser calls could fork
// a user and split their credits; findUserByPhone's `order: updatedAt DESC` is
// the workaround that exists precisely because duplicates were possible.
//
// Two steps, in order:
//   1. Canonicalize legacy rows to E.164 ('+<digits>'). Both formats are stored
//      today, which is why phoneWhere() has to match `IN ('+91…','91…')`.
//      Done in JS, not REGEXP_REPLACE — portable, and these tables are tiny.
//   2. Add the UNIQUE. It FAILS LOUDLY if duplicates exist: merging two users'
//      credits is a money decision, not something a migration should guess at.
//
// NULL phones (the anonymous/legacy chart path) stay allowed — UNIQUE permits
// many NULLs.

const digitsOf = (p) => String(p || '').replace(/\D/g, '');

async function canonicalize(q, table) {
  const [rows] = await q.sequelize.query(
    `SELECT id, phone FROM ${q.quoteIdentifier(table)} WHERE phone IS NOT NULL AND phone NOT LIKE '+%'`,
  );
  for (const { id, phone } of rows) {
    const d = digitsOf(phone);
    if (!d) continue;
    await q.bulkUpdate(table, { phone: `+${d}` }, { id });
  }
  return rows.length;
}

export async function up({ context: q }) {
  await canonicalize(q, 'AuthAccounts');
  await canonicalize(q, 'Users');

  const [dupes] = await q.sequelize.query(
    `SELECT phone, COUNT(*) c FROM ${q.quoteIdentifier('Users')}
      WHERE phone IS NOT NULL GROUP BY phone HAVING c > 1`,
  );
  if (dupes.length) {
    throw new Error(
      `Cannot add UNIQUE(Users.phone): ${dupes.length} duplicated phone(s) — `
      + `${dupes.map((d) => `${d.phone}×${d.c}`).join(', ')}. `
      + 'Merge the credit balances by hand first (the ledger is append-only, so '
      + 'move the loser\'s credits with a grant, then delete the empty row).',
    );
  }

  const idx = await q.showIndex('Users').catch(() => []);
  if (idx.some((i) => i.name === 'users_phone_unique')) return;
  // The old non-unique index on the same column becomes redundant once the
  // UNIQUE exists — MySQL will serve every lookup from the UNIQUE.
  await q.addIndex('Users', ['phone'], { name: 'users_phone_unique', unique: true });
  // No .catch here on purpose: swallowing this hid a real failure once, and a
  // silently-kept duplicate index is exactly the kind of thing nobody notices.
  if (idx.some((i) => i.name === 'users_phone')) await q.removeIndex('Users', 'users_phone');
}

export async function down({ context: q }) {
  await q.removeIndex('Users', 'users_phone_unique');
  await q.addIndex('Users', ['phone'], { name: 'users_phone' });
}
