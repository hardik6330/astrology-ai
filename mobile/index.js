import "react-native-gesture-handler";
import { registerRootComponent } from "expo";
import Constants, { ExecutionEnvironment } from "expo-constants";
import App from "./App";

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Handle data messages that arrive while the app is in the background / killed.
// RN Firebase requires this registered at the entry point, outside React. Our
// pushes are mostly notification-only (FCM renders them itself), so this is a
// thin hook for any future data-only payloads.
//
// Wrapped in try/catch + lazy require: in Expo Go (or an APK built before
// Firebase was added) the RNFBAppModule native module is absent and importing
// messaging throws. Swallow it so the app still boots with push disabled —
// real push only works in a native build that includes the module.
if (!isExpoGo) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const messaging = require("@react-native-firebase/messaging").default;
    messaging().setBackgroundMessageHandler(async () => {});
  } catch (err) {
    if (__DEV__) console.warn("[push] background handler skipped — native module absent:", err?.message);
  }
}

registerRootComponent(App);
