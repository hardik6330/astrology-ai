// Thin wrapper over the Firebase Analytics instance already initialised in
// features/auth/firebaseConfig.js. Mirrors mobile's
// features/notifications/analytics.js — keep the EVENT NAMES identical across
// the two so one funnel covers both clients.
//
// Analytics isn't supported everywhere (SSR, http on a LAN IP, some privacy
// modes), so every call resolves the instance lazily and fails silently. No
// screen-view helper here: firebase's browser SDK logs page_view automatically.
//
// ⚠️ Never pass a phone number, name, or birth details as an event param.
// Firebase is a third party; counts are the point, not who.

import { getAnalytics, isSupported, logEvent as fbLogEvent } from "firebase/analytics";
import { firebaseApp } from "@/features/auth/firebaseConfig";

let instance;
async function analytics() {
  if (instance !== undefined) return instance;
  instance = (await isSupported().catch(() => false)) ? getAnalytics(firebaseApp) : null;
  return instance;
}

export async function logEvent(name, params = {}) {
  try {
    const a = await analytics();
    if (a) fbLogEvent(a, name, params);
  } catch (err) {
    if (import.meta.env.DEV) console.warn("[analytics] logEvent skipped:", err?.message);
  }
}
