// Thin wrapper over react-native-purchases (RevenueCat) with a LAZY native
// require, so the app still boots in Expo Go (no native module there).
// Callers gate on `iapAvailable()`; the throw in mod() is only a safety net.
//
// The app never sees a receipt: RevenueCat verifies with Apple and posts the
// event to the backend webhook, which grants the credits. So after
// `purchaseProduct()` resolves the client just re-fetches its balance.
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Public SDK keys (safe to ship) — set per platform via `eas env:create`.
const API_KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_RC_IOS_KEY,
  android: process.env.EXPO_PUBLIC_RC_ANDROID_KEY,
});

let Purchases = null;
let loadFailed = false;
let configured = false;

// True only when the native module is loadable AND a key exists for this platform.
export function iapAvailable() {
  if (isExpoGo || loadFailed || !API_KEY) return false;
  if (!Purchases) {
    try {
      Purchases = require("react-native-purchases").default;
    } catch {
      loadFailed = true;
      return false;
    }
  }
  return !!Purchases;
}

function mod() {
  if (!iapAvailable()) throw new Error("In-app purchases aren't available in this build.");
  return Purchases;
}

// Idempotent; safe to call from every screen that needs the store.
export function configure() {
  if (configured || !iapAvailable()) return;
  Purchases.configure({ apiKey: API_KEY });
  configured = true;
}

// Bind the store customer to OUR User.id so the webhook's app_user_id lands
// on this ledger. Call after login; logOut on sign-out so the next account
// on this device doesn't inherit (or get handed) the previous one's purchases.
export async function logIn(userId) {
  if (!iapAvailable() || !userId) return;
  configure();
  await Purchases.logIn(String(userId));
}
export async function logOut() {
  if (!iapAvailable() || !configured) return;
  try {
    if (!(await Purchases.isAnonymous())) await Purchases.logOut();
  } catch { /* already anonymous / offline — nothing to undo */ }
}

// Store products keyed by product id, with localized price strings. Fetched by
// id (not via Offerings) so the admin panel's plan list stays the source of
// truth for what's on sale.
export async function getProducts(ids) {
  configure();
  const list = await mod().getProducts(ids);
  return Object.fromEntries(list.map((p) => [p.identifier, p]));
}

// Run the native purchase sheet. Resolves when Apple confirms; the credits
// arrive via the backend webhook a moment later. Throws with
// `userCancelled: true` when the sheet is dismissed.
export async function purchaseProduct(product) {
  configure();
  return mod().purchaseStoreProduct(product);
}

export const E_USER_CANCELLED = "PURCHASE_CANCELLED";
