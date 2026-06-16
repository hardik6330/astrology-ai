// The random-sample audience mode was removed — notifications now go to
// either 'all' or 'random_one'. The `notif_sample_pct` setting is dead, and
// any DB still holding notif_audience='random_sample' must move to 'all'
// (the engage job already falls through to 'all' for an unknown mode, but the
// admin dropdown no longer offers 'random_sample', so we normalise the stored
// value). Seeds are create-only and never delete, so this runs once per DB.
// Idempotent: a DB without the row / already on 'all' is a no-op. `down` is
// intentionally empty — we don't bring back a removed feature.

export async function up({ context: qi }) {
  await qi.bulkDelete('Settings', { key: 'notif_sample_pct' });
  await qi.bulkUpdate(
    'Settings',
    { value: 'all' },
    { key: 'notif_audience', value: 'random_sample' },
  );
}

export async function down() {
  /* no-op — the random-sample audience mode was removed, not paused */
}
