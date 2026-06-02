// Firebase web SDK init. We use it for:
//   1. Phone Auth (OTP) — getAuth + signInWithPhoneNumber
//   2. Analytics — getAnalytics (page view tracking)
//   3. Cloud Messaging — web push notifications (see features/notifications)
// All other data still lives in our own backend (MySQL).

import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported as analyticsSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getMessaging, isSupported as messagingSupported } from "firebase/messaging";

// Keep this config in sync with frontend/public/firebase-messaging-sw.js — the
// background service worker can't import this module, so it hardcodes its own copy.
export const firebaseConfig = {
  apiKey: "AIzaSyDeP9lVD48v__XAi3w5PS-gR9Hl9Ou2_lg",
  authDomain: "astrology-ai-abc38.firebaseapp.com",
  projectId: "astrology-ai-abc38",
  storageBucket: "astrology-ai-abc38.firebasestorage.app",
  messagingSenderId: "160095118157",
  appId: "1:160095118157:web:1ddb20119df02911facd04",
  measurementId: "G-3QWLMK4B4S",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);

// Messaging needs a secure context (https / localhost) + browser support, so
// resolve it lazily. Returns the messaging instance or null where unsupported
// (Safari < 16.4 without config, http on a LAN IP, SSR). Callers must handle null.
export async function getMessagingIfSupported() {
  try {
    if (!(await messagingSupported())) return null;
    return getMessaging(firebaseApp);
  } catch {
    return null;
  }
}

// Analytics fails silently in environments where it's not supported (SSR,
// non-https http preview). We don't await this — page rendering shouldn't block.
analyticsSupported()
  .then((ok) => {
    if (ok) getAnalytics(firebaseApp);
  })
  .catch(() => {});
