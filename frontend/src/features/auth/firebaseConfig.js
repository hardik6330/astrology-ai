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
const firebaseConfig = {
  apiKey: "AIzaSyDphpDaRfEPouJYcvHF8sh5QLh-Gt21P3A",
  authDomain: "future-ai-b05ad.firebaseapp.com",
  projectId: "future-ai-b05ad",
  storageBucket: "future-ai-b05ad.firebasestorage.app",
  messagingSenderId: "897985872810",
  appId: "1:897985872810:web:4855f2853a4636fe9aa1d3",
  measurementId: "G-RXYJL7N99L",
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
