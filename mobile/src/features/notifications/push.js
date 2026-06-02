// FCM push registration via @react-native-firebase/messaging. Grabs the device
// token, ships it to our backend, and keeps it fresh on rotation. Android-only
// in practice (no paid Apple account → no APNs).
//
// NOTE: native module — requires an EAS dev/preview build. It is a no-op in
// Expo Go, so every call is guarded and failures are swallowed (push is a
// best-effort enhancement, never a blocker for the core app).

import { Platform } from "react-native";
import { registerPushToken, unregisterPushToken } from "@/services/api";

let unsubscribeRefresh = null;
let unsubscribeForeground = null;
let androidChannelId = null;

// Lazy require: a static import of the Firebase module throws at load time when
// the native module isn't compiled in (Expo Go / pre-Firebase APK). Requiring
// it inside the guarded functions keeps the app bootable with push disabled.
function getMessaging() {
  return require("@react-native-firebase/messaging").default;
}

// Same lazy-require guard for notifee (also a native module, absent in Expo Go).
function getNotifee() {
  const mod = require("@notifee/react-native");
  return { notifee: mod.default, AndroidImportance: mod.AndroidImportance };
}

// Ask the OS for permission to DISPLAY notifications. On Android this is only
// needed to show the banner (API 33+); the token works without it. Fire-and-
// forget — we never block token storage on the answer.
export async function requestDisplayPermission() {
  try {
    await getMessaging()().requestPermission();
  } catch (err) {
    if (__DEV__) console.warn("[push] requestDisplayPermission skipped:", err?.message);
  }
}

// Call after login (and on app launch when already signed in). Safe to call
// repeatedly — registration is idempotent on the backend.
//
// We DO NOT gate on permission: on Android getToken() returns a valid token
// even when notifications are denied, so we store it immediately. Permission
// only decides whether the banner is shown, which we request separately.
export async function registerForPush() {
  try {
    const messaging = getMessaging();

    const token = await messaging().getToken();
    if (!token) return;
    await registerPushToken(token, Platform.OS);

    // Re-send whenever FCM rotates the token (reinstall, restore, etc.).
    unsubscribeRefresh?.();
    unsubscribeRefresh = messaging().onTokenRefresh((next) => {
      registerPushToken(next, Platform.OS).catch(() => {});
    });

    // Best-effort, non-blocking: prompt for display permission so the stored
    // token can actually surface banners. Token is already saved regardless.
    requestDisplayPermission();
  } catch (err) {
    // Expo Go / missing native module / offline — all non-fatal.
    if (__DEV__) console.warn("[push] registerForPush skipped:", err?.message);
  }
}

// Call on logout: disable the token server-side and stop listening for refresh.
export async function unregisterForPush() {
  try {
    unsubscribeRefresh?.();
    unsubscribeRefresh = null;
    const token = await getMessaging()().getToken().catch(() => null);
    if (token) await unregisterPushToken(token);
  } catch (err) {
    if (__DEV__) console.warn("[push] unregisterForPush skipped:", err?.message);
  }
}

// ── Foreground display ───────────────────────────────────────────────────────
//
// FCM does NOT draw a notification while the app is in the FOREGROUND — it just
// hands the message to messaging().onMessage and stops (same rule as the web /
// browser). So when the user is actively in the app, nothing shows unless we
// render it ourselves. notifee.displayNotification() draws a real system
// notification on demand, matching what the OS does automatically when the app
// is backgrounded.
//
// Idempotent + guarded: safe to call on every app launch; a no-op in Expo Go.
export async function setupForegroundNotifications() {
  try {
    const { notifee, AndroidImportance } = getNotifee();
    const messaging = getMessaging();

    // Android requires a channel before any notification can be shown (8.0+).
    androidChannelId = await notifee.createChannel({
      id: "default",
      name: "General",
      importance: AndroidImportance.HIGH,
    });

    // Re-arm cleanly if called twice (e.g. fast refresh / re-login).
    unsubscribeForeground?.();
    unsubscribeForeground = messaging().onMessage(async (remoteMessage) => {
      const n = remoteMessage?.notification;
      // Fall back to data fields if the payload is data-only.
      const title = n?.title || remoteMessage?.data?.title;
      const body = n?.body || remoteMessage?.data?.body;
      if (!title && !body) return;

      await notifee.displayNotification({
        title,
        body,
        data: remoteMessage?.data || {},
        android: {
          channelId: androidChannelId,
          smallIcon: "ic_launcher",
          pressAction: { id: "default" },
        },
      });
    });
  } catch (err) {
    if (__DEV__) console.warn("[push] setupForegroundNotifications skipped:", err?.message);
  }
}
