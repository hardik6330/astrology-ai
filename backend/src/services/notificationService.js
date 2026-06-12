// Low-level FCM fan-out. Given a list of PushToken rows + a notification
// payload, sends via firebase-admin and prunes tokens FCM reports as dead.
// Higher-level "who gets what" logic lives in pushService.js.

import { getMessaging } from '../config/firebase.js';
import { PushToken } from '../models/index.js';
import { logger } from '../config/logger.js';

const log = logger.child({ mod: 'push' });

// FCM caps multicast at 500 tokens per call.
const FCM_BATCH = 500;

// Error codes that mean "this token is permanently gone" — disable so we stop
// paying to send to it. Transient errors (quota, server) are left enabled.
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Send one notification to many devices.
 * @param {Array<{id,token}>} rows  PushToken rows (need .token + .id)
 * @param {{title,body,data?}} msg
 * @returns {{sent:number, failed:number, disabled:number}}
 */
export async function sendToTokens(rows, { title, body, data = {} }) {
  if (!rows.length) return { sent: 0, failed: 0, disabled: 0 };

  // Log every outgoing notification at the single chokepoint all senders share
  // (engagement, daily, welcome, admin broadcast, insight) — title/body + the
  // recipient count + the campaign type, so deliveries are traceable in logs.
  log.info({ title, body, recipients: rows.length, type: data.type || 'unknown' }, 'sending notification');

  const messaging = getMessaging();
  // FCM data values must be strings.
  const stringData = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]));

  let sent = 0, failed = 0;
  const deadIds = [];
  const errorCounts = {};   // { 'messaging/...': count } — for diagnosis
  let sampleError = null;   // first human-readable failure message

  for (const batch of chunk(rows, FCM_BATCH)) {
    const res = await messaging.sendEachForMulticast({
      tokens: batch.map((r) => r.token),
      notification: { title, body },
      data: stringData,
      // Route to the app's "default-sound" channel so BACKGROUND (FCM-drawn)
      // notifications play res/raw/notification.wav. ⚠️ This channel must exist
      // on the device — the app creates it on launch (push.js). If the backend
      // is deployed BEFORE users have the app build that creates it, Android 8+
      // silently DROPS the notification. Deploy order: ship the EAS app build
      // first, then this backend. `sound` is a fallback for pre-O devices.
      android: {
        priority: 'high',
        notification: { channelId: 'default-sound', sound: 'notification' },
      },
      // iOS (dormant until APNs): play the bundled sound on the alert.
      apns: {
        payload: { aps: { sound: 'notification.wav' } },
      },
      // Web push: give the SW an icon + a click-through URL so background
      // notifications render consistently across Chrome/Brave/Firefox. (Custom
      // sound is NOT possible for backgrounded web — the SW plays the system
      // sound only; the foreground chime lives in webPush.js.)
      webpush: {
        notification: { title, body, icon: '/icon.svg' },
        fcmOptions: stringData.screen ? { link: `/${stringData.screen}` } : undefined,
      },
    });
    res.responses.forEach((r, i) => {
      if (r.success) { sent++; return; }
      failed++;
      const code = r.error?.code || 'unknown';
      errorCounts[code] = (errorCounts[code] || 0) + 1;
      if (!sampleError) sampleError = r.error?.message || code;
      if (r.error && DEAD_TOKEN_CODES.has(code)) deadIds.push(batch[i].id);
    });
  }

  if (deadIds.length) {
    await PushToken.update({ enabled: false }, { where: { id: deadIds } });
    log.info({ count: deadIds.length }, 'disabled dead push tokens');
  }

  if (failed) log.warn({ errorCounts, sampleError }, 'push send had failures');
  log.info({ sent, failed, disabled: deadIds.length, total: rows.length }, 'push fan-out done');
  // Surface the error breakdown so a manual cron/test call can see WHY it failed.
  return { sent, failed, disabled: deadIds.length, ...(failed && { errors: errorCounts, sampleError }) };
}
