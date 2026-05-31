// Firebase web SDK init. We use it for two things:
//   1. Phone Auth (OTP) — getAuth + signInWithPhoneNumber
//   2. Analytics — getAnalytics (page view tracking)
// All other data still lives in our own backend (MySQL).

import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported as analyticsSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
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

// Analytics fails silently in environments where it's not supported (SSR,
// non-https http preview). We don't await this — page rendering shouldn't block.
analyticsSupported()
  .then((ok) => {
    if (ok) getAnalytics(firebaseApp);
  })
  .catch(() => {});
