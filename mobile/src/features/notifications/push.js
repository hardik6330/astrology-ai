// FCM push registration via @react-native-firebase/messaging. Grabs the device
// token, ships it to our backend, and keeps it fresh on rotation. Android-only
// in practice (no paid Apple account → no APNs).
//
// NOTE: native module — requires an EAS dev/preview build. It is a no-op in
// Expo Go, so every call is guarded and failures are swallowed (push is a
// best-effort enhancement, never a blocker for the core app).

import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { registerPushToken, unregisterPushToken } from "@/services/api";
import { navigateFromNotification } from "@/navigation/navigationRef";

// Firebase messaging + notifee are native modules that don't exist in Expo Go.
// Short-circuit every entry point so the dev console isn't flooded with
// "native module not found" warnings on each launch / screen change. In a real
// EAS build this is false and push works normally.
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let unsubscribeRefresh = null;
let unsubscribeForeground = null;
let unsubscribeForegroundEvent = null;
let unsubscribeOpened = null;
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
  return { notifee: mod.default, AndroidImportance: mod.AndroidImportance, EventType: mod.EventType };
}

// Ask the OS for permission to DISPLAY notifications. On Android this is only
// needed to show the banner (API 33+); the token works without it. Fire-and-
// forget — we never block token storage on the answer.
export async function requestDisplayPermission() {
  if (isExpoGo) return;
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
  if (isExpoGo) return;
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
  if (isExpoGo) return;
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
  if (isExpoGo) return;
  try {
    const { notifee, AndroidImportance, EventType } = getNotifee();
    const messaging = getMessaging();

    // Android requires a channel before any notification can be shown (8.0+).
    androidChannelId = await notifee.createChannel({
      id: "default",
      name: "General",
      importance: AndroidImportance.HIGH,
    });

    // Tap on a notifee-rendered notification (foreground case) → deep-link to
    // the screen the backend set in data.screen. Re-arm cleanly if called twice.
    unsubscribeForegroundEvent?.();
    unsubscribeForegroundEvent = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS) {
        navigateFromNotification(detail.notification?.data?.screen);
      }
    });

    // Re-arm cleanly if called twice (e.g. fast refresh / re-login).
    unsubscribeForeground?.();
    unsubscribeForeground = messaging().onMessage(async (remoteMessage) => {
      // This callback runs asynchronously when a push arrives — OUTSIDE the
      // setup try/catch below. Guard it independently so a missing/partial
      // native module (RNFBAppModule, notifee) can never surface as an
      // uncaught error / red screen.
      try {
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
      } catch (err) {
        if (__DEV__) console.warn("[push] onMessage display skipped:", err?.message);
      }
    });
  } catch (err) {
    if (__DEV__) console.warn("[push] setupForegroundNotifications skipped:", err?.message);
  }
}

// ── Tap-to-navigate for BACKGROUND / QUIT notifications ──────────────────────
//
// FCM draws the banner itself when the app is backgrounded or killed, so the
// tap surfaces through messaging() (not notifee). Two cases:
//   • app in background → onNotificationOpenedApp fires on tap
//   • app was quit      → getInitialNotification returns the tap that launched it
// Both deep-link via data.screen. Call once on app launch; no-op in Expo Go.
export async function setupNotificationNavigation() {
  if (isExpoGo) return;
  try {
    const messaging = getMessaging();

    unsubscribeOpened?.();
    unsubscribeOpened = messaging().onNotificationOpenedApp((remoteMessage) => {
      navigateFromNotification(remoteMessage?.data?.screen);
    });

    // Cold start: the notification that launched the app (null if launched normally).
    const initial = await messaging().getInitialNotification();
    if (initial) navigateFromNotification(initial?.data?.screen);
  } catch (err) {
    if (__DEV__) console.warn("[push] setupNotificationNavigation skipped:", err?.message);
  }
}
