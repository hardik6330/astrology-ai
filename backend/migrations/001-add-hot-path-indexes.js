// Hot-path indexes for tables created before these were declared on the
// models. sync() never alters existing tables, so existing DBs (local MySQL,
// Railway prod) get them here; fresh installs get them at CREATE TABLE from
// the model `indexes` blocks — SAME names, so the two paths converge.
//
//   Users.users_name_birth_date        — findUserByForm runs on every content
//                                        request (kundali/daily/palm/chat all
//                                        resolve the user by name+birth fields)
//   Users.users_phone                  — phone-scoped form lookups (equality;
//                                        the '%digits' login LIKE can't index)
//   DailyData.daily_data_user_date     — { userId, date } on every daily fetch
//   PalmReadings.palm_readings_user_image_hash — per-scan dedupe before AI spend
//   Purchases.purchases_created_at     — admin order list, newest first
//   Purchases.purchases_status_updated_at — revenue sums (paid, this-month)

const INDEXES = [
  { table: 'Users', name: 'users_name_birth_date', fields: ['name', 'birthDate'] },
  { table: 'Users', name: 'users_phone', fields: ['phone'] },
  { table: 'DailyData', name: 'daily_data_user_date', fields: ['userId', 'date'] },
  { table: 'PalmReadings', name: 'palm_readings_user_image_hash', fields: ['userId', 'imageHash'] },
  { table: 'Purchases', name: 'purchases_created_at', fields: ['createdAt'] },
  { table: 'Purchases', name: 'purchases_status_updated_at', fields: ['status', 'updatedAt'] },
];

export async function up({ context: qi }) {
  for (const { table, name, fields } of INDEXES) {
    // Idempotent: a DB that already has the index (e.g. table re-created by
    // sync() with the model declarations) is skipped, not errored.
    const existing = await qi.showIndex(table);
    if (existing.some((i) => i.name === name)) continue;
    await qi.addIndex(table, fields, { name });
  }
}

export async function down({ context: qi }) {
  for (const { table, name } of INDEXES) {
    const existing = await qi.showIndex(table);
    if (existing.some((i) => i.name === name)) await qi.removeIndex(table, name);
  }
}
