// Renewal sync.
//
// The store, not our backend, drives subscription renewals — and without Apple
// Server Notifications / Google RTDN configured, nothing tells us a new cycle
// started. So the app re-verifies its active entitlements on launch and the
// backend grants any cycle it hasn't granted yet.
//
// Safe to call as often as we like: the grant is gated by a UNIQUE store
// transaction id, so a re-verify inside the same cycle grants nothing.

import { Platform } from "react-native";
import { iapAvailable, initConnection, getAvailablePurchases } from "./iapClient";
import { verifySubscription, fetchCreditPlans, getCredits } from "@/services/api";

let inFlight = null;

async function run() {
  if (!iapAvailable()) return; // Expo Go / no store build — nothing to sync.

  try {
    await initConnection();
    const purchases = await getAvailablePurchases();
    if (!purchases?.length) return;

    // Match store SKUs back to our plans; a SKU we don't recognise isn't ours.
    const plans = await fetchCreditPlans();
    const subPlans = plans.filter((p) => p.isSubscription && p.productId);
    if (!subPlans.length) return;

    let granted = 0;
    for (const purchase of purchases) {
      const plan = subPlans.find((p) => p.productId === purchase.productId);
      if (!plan) continue;
      try {
        const res = await verifySubscription({
          planId: plan.id,
          platform: Platform.OS,
          receipt: Platform.OS === "ios" ? purchase.transactionReceipt : undefined,
          purchaseToken: Platform.OS === "android" ? purchase.purchaseToken : undefined,
        });
        granted += res?.granted || 0;
      } catch {
        // A single bad entitlement must not block the others, and this runs in
        // the background — the user has nothing to act on.
      }
    }
    if (granted) getCredits(); // refresh the badge only when something changed
  } catch {
    /* offline / store unavailable — retried on the next launch */
  }
}

// De-duplicated: concurrent callers share one pass.
export function syncSubscription() {
  if (!inFlight) inFlight = run().finally(() => { inFlight = null; });
  return inFlight;
}
