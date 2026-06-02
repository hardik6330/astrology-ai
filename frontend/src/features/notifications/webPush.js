// Web push (FCM) registration for the browser. Mirrors the mobile push flow:
// permission → token → POST /api/push/register. Everything is guarded so it
// no-ops (never throws) where push isn't available.
//
// ⚠️ Requires a SECURE CONTEXT: works on https:// or http://localhost only.
// On a plain-http LAN IP (e.g. http://192.168.x.x:5173) Service Workers and the
// Notification API are disabled by the browser, so this silently no-ops there.

import { getToken, onMessage } from "firebase/messaging";
import { getMessagingIfSupported } from "@/features/auth/firebaseConfig";
import { registerWebPushToken } from "@/services/api";

// Web Push certificate (VAPID public key) from Firebase Console →
// Project Settings → Cloud Messaging → Web Push certificates.
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || "";

let foregroundUnsub = null;
let swRegistration = null;

// Register the FCM service worker. Vite serves public/ at the root, so the file
// is reachable at /firebase-messaging-sw.js with whole-app scope.
async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  swRegistration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  return swRegistration;
}

// Call after login. Idempotent — backend upserts on the token.
export async function registerForWebPush() {
  try {
    if (!VAPID_KEY) {
      console.warn("[webPush] VITE_FIREBASE_VAPID_KEY not set — skipping");
      return;
    }
    const messaging = await getMessagingIfSupported();
    if (!messaging) return; // unsupported browser / insecure context

    // Ask permission (no-op if already granted/denied).
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const swReg = await registerServiceWorker();
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg || undefined,
    });
    if (!token) return;

    await registerWebPushToken(token);

    // Foreground messages aren't shown by the browser automatically — render
    // them ourselves. Use the SW registration's showNotification (NOT the
    // `new Notification()` constructor, which Chrome/Brave reject when a service
    // worker is active). The SW handles background; guard against double-binding.
    foregroundUnsub?.();
    foregroundUnsub = onMessage(messaging, (payload) => {
      const { title, body } = payload.notification || {};
      const reg = swRegistration || swReg;
      if (Notification.permission === "granted" && reg) {
        reg.showNotification(title || "Astrology AI", {
          body: body || "",
          icon: "/icon.svg",
          data: payload.data || {},
        });
      }
    });
  } catch (err) {
    console.warn("[webPush] registerForWebPush skipped:", err?.message);
  }
}

// Stop foreground listening on logout. (The token is left registered; add a
// /push/unregister call here later if you want logout to silence the device.)
export function teardownWebPush() {
  foregroundUnsub?.();
  foregroundUnsub = null;
}
