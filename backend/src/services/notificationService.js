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

  const messaging = getMessaging();
  // FCM data values must be strings.
  const stringData = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]));

  let sent = 0, failed = 0;
  const deadIds = [];

  for (const batch of chunk(rows, FCM_BATCH)) {
    const res = await messaging.sendEachForMulticast({
      tokens: batch.map((r) => r.token),
      notification: { title, body },
      data: stringData,
      // No explicit channelId: a non-existent channel makes Android 8+ silently
      // drop the notification. Letting FCM fall back to its auto-created default
      // channel guarantees display until the app defines its own channels.
      android: { priority: 'high' },
    });
    res.responses.forEach((r, i) => {
      if (r.success) { sent++; return; }
      failed++;
      if (r.error && DEAD_TOKEN_CODES.has(r.error.code)) deadIds.push(batch[i].id);
    });
  }

  if (deadIds.length) {
    await PushToken.update({ enabled: false }, { where: { id: deadIds } });
    log.info({ count: deadIds.length }, 'disabled dead push tokens');
  }

  log.info({ sent, failed, disabled: deadIds.length, total: rows.length }, 'push fan-out done');
  return { sent, failed, disabled: deadIds.length };
}
