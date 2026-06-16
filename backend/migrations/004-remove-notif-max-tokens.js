// The per-send recipient cap (`notif_max_tokens`) was removed — engagement
// pushes now fan out to every enabled device, batched at 500/call by
// notificationService (FCM's per-call max). Seeds are create-only and never
// delete, so existing DBs keep the dead row until this runs. Idempotent: a DB
// without the row is a no-op. `down` is intentionally empty — the cap was
// removed, not paused.

export async function up({ context: qi }) {
  await qi.bulkDelete('Settings', { key: 'notif_max_tokens' });
}

export async function down() {
  /* no-op — the per-send cap was removed, not paused */
}
