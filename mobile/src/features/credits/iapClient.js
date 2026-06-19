// Thin wrapper over react-native-iap with a LAZY native require, so the app
// still boots in Expo Go (the native module doesn't exist there) and in any
// build where the dep failed to link. Everything funnels through `mod()`, which
// throws a clear, user-facing error when IAP isn't available — callers gate on
// `iapAvailable()` first so that throw is only a safety net.
//
// ⚠️ react-native-iap's API shifts between majors. This targets v14+ (the nitro
// rewrite — see react-native-nitro-modules in package.json). If you pin a
// different major, re-check requestPurchase/getProducts/finishTransaction
// shapes against that version's docs.
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let RNIap = null;
let loadFailed = false;

// True only when the native module is actually loadable. Cheap to call repeatedly.
export function iapAvailable() {
  if (isExpoGo || loadFailed) return false;
  if (!RNIap) {
    try {
      RNIap = require("react-native-iap");
    } catch {
      loadFailed = true;
      return false;
    }
  }
  return !!RNIap;
}

function mod() {
  if (!iapAvailable()) {
    throw new Error("In-app purchases aren't available in this build.");
  }
  return RNIap;
}

export const initConnection = () => mod().initConnection();
export const endConnection = () => RNIap?.endConnection?.();

// Localized product details for the given store SKUs (price/title from the store).
export const getProducts = (skus) => mod().getProducts({ skus });

// Kick off the native purchase sheet. iOS takes a single `sku`, Android `skus`.
// Resolution (success/error) arrives asynchronously via the listeners below —
// this promise only reflects that the request was dispatched.
export const requestPurchase = (sku) =>
  Platform.OS === "ios"
    ? mod().requestPurchase({ sku })
    : mod().requestPurchase({ skus: [sku] });

// Credits are consumable — finishing with isConsumable lets the user re-buy.
export const finishTransaction = (purchase) =>
  mod().finishTransaction({ purchase, isConsumable: true });

export const purchaseUpdatedListener = (cb) => mod().purchaseUpdatedListener(cb);
export const purchaseErrorListener = (cb) => mod().purchaseErrorListener(cb);

// E_USER_CANCELLED differs by version; fall back to the historical string code.
export const getErrorCodes = () => RNIap?.ErrorCode ?? { E_USER_CANCELLED: "E_USER_CANCELLED" };
