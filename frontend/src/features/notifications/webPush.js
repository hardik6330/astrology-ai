// Web push (FCM) registration for the browser. Mirrors the mobile push flow:
// permission → token → POST /api/push/register. Everything is guarded so it
// no-ops (never throws) where push isn't available.
//
// NOTE: Requires a SECURE CONTEXT: works on https:// or http://localhost only.
// On a plain-http LAN IP (e.g. http://192.168.x.x:5173) Service Workers and the
// Notification API are disabled by the browser, so this silently no-ops there.

import { getToken, onMessage } from "firebase/messaging";
import { getMessagingIfSupported } from "@/features/auth/firebaseConfig";
import { registerWebPushToken } from "@/services/api";

// Web Push certificate (VAPID public key) from Firebase Console →
// Project Settings → Cloud Messaging → Web Push certificates.
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || "";

// Dedicated scope the Firebase SDK uses for its service worker. Kept separate
// from the PWA worker's "/" scope so the two never clobber each other.
const FCM_SW_SCOPE = "/firebase-cloud-messaging-push-scope";

let foregroundUnsub = null;

// Play a short chime when a push arrives while the tab is OPEN. Best-effort:
// browsers block autoplay until the user has interacted with the page, so the
// very first one may be silently rejected — we swallow that. (Backgrounded web
// notifications can't play a custom sound at all — a service-worker
// showNotification only triggers the system sound — so this is foreground-only.)
function playChime() {
  try {
    const audio = new Audio("/notification.wav");
    audio.volume = 0.6;
    audio.play().catch(() => {}); // autoplay blocked / file missing — ignore
  } catch {
    /* no Audio support — ignore */
  }
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

    // Do NOT pass serviceWorkerRegistration — let the SDK register
    // firebase-messaging-sw.js at its OWN scope (FCM_SW_SCOPE). Registering it
    // ourselves at "/" collides with the vite-plugin-pwa worker (also "/"), and
    // the PWA's auto-register clobbers it — so pushes hit the wrong SW and Chrome
    // shows its generic "site updated in the background" placeholder.
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!token) return;

    await registerWebPushToken(token);

    // Foreground messages aren't shown automatically — render them via the FCM
    // SW's showNotification (NOT the `new Notification()` constructor, which
    // Chrome/Brave reject when a service worker is active). Background messages
    // are handled by onBackgroundMessage in firebase-messaging-sw.js.
    foregroundUnsub?.();
    foregroundUnsub = onMessage(messaging, async (payload) => {
      const { title, body } = payload.notification || {};
      const reg = await navigator.serviceWorker.getRegistration(FCM_SW_SCOPE);
      if (Notification.permission === "granted" && reg) {
        playChime(); // foreground-only custom sound (see note on playChime)
        reg.showNotification(title || "Selora", {
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
