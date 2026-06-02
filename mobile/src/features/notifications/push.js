// FCM push registration via @react-native-firebase/messaging. Requests
// permission, grabs the device token, ships it to our backend, and keeps it
// fresh on rotation. Android-only in practice (no paid Apple account → no APNs).
//
// NOTE: native module — requires an EAS dev/preview build. It is a no-op in
// Expo Go, so every call is guarded and failures are swallowed (push is a
// best-effort enhancement, never a blocker for the core app).

import { Platform } from "react-native";
import { registerPushToken, unregisterPushToken } from "@/services/api";

let unsubscribeRefresh = null;

// Lazy require: a static import of the Firebase module throws at load time when
// the native module isn't compiled in (Expo Go / pre-Firebase APK). Requiring
// it inside the guarded functions keeps the app bootable with push disabled.
function getMessaging() {
  return require("@react-native-firebase/messaging").default;
}

async function hasPermission() {
  const messaging = getMessaging();
  const status = await messaging().requestPermission();
  const { AUTHORIZED, PROVISIONAL } = messaging.AuthorizationStatus;
  return status === AUTHORIZED || status === PROVISIONAL;
}

// Call after login (and on app launch when already signed in). Safe to call
// repeatedly — registration is idempotent on the backend.
export async function registerForPush() {
  try {
    if (!(await hasPermission())) return;

    const messaging = getMessaging();
    const token = await messaging().getToken();
    if (!token) return;
    await registerPushToken(token, Platform.OS);

    // Re-send whenever FCM rotates the token (reinstall, restore, etc.).
    unsubscribeRefresh?.();
    unsubscribeRefresh = messaging().onTokenRefresh((next) => {
      registerPushToken(next, Platform.OS).catch(() => {});
    });
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
