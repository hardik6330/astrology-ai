// Thin wrapper over @react-native-firebase/analytics. Auto-collection (app
// open, screen time, device info) works out of the box once the native module
// is present; these helpers add explicit screen + event logging. All calls are
// guarded so they no-op safely in Expo Go / when the module isn't linked.

import Constants, { ExecutionEnvironment } from "expo-constants";

// Native module absent in Expo Go — short-circuit so screen changes don't flood
// the dev console with "RNFBAppModule not found" warnings. See push.js.
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Lazy require — a static import throws at load time when the native module
// isn't compiled in (Expo Go / pre-Firebase APK). See push.js for the rationale.
function analytics() {
  return require("@react-native-firebase/analytics").default();
}

export async function logScreenView(screenName) {
  if (isExpoGo) return;
  try {
    await analytics().logScreenView({ screen_name: screenName, screen_class: screenName });
  } catch (err) {
    if (__DEV__) console.warn("[analytics] logScreenView skipped:", err?.message);
  }
}

export async function logEvent(name, params = {}) {
  if (isExpoGo) return;
  try {
    await analytics().logEvent(name, params);
  } catch (err) {
    if (__DEV__) console.warn("[analytics] logEvent skipped:", err?.message);
  }
}
