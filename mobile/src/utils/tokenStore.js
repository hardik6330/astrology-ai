// M4: the session JWT lives in the OS keychain/keystore via expo-secure-store,
// not plaintext AsyncStorage (where any other code / a rooted-device dump could
// read it). Only the token is sensitive; the account blob stays in AsyncStorage.
//
// expo-secure-store is a built-in Expo module (works in Expo Go), but a device
// can still deny keychain access — every call is wrapped so a failure degrades
// to "logged out", never a crash. A one-time migration lifts any pre-existing
// AsyncStorage token into SecureStore so updating users aren't forced to re-login.

import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "app_token";

export async function getToken() {
  try {
    const secure = await SecureStore.getItemAsync(KEY);
    if (secure) return secure;
    // Migrate a legacy plaintext token, then scrub it from AsyncStorage.
    const legacy = await AsyncStorage.getItem(KEY);
    if (legacy) {
      await setToken(legacy);
      await AsyncStorage.removeItem(KEY);
      return legacy;
    }
    return null;
  } catch {
    return null;
  }
}

export async function setToken(token) {
  try {
    await SecureStore.setItemAsync(KEY, token);
  } catch {
    /* keychain unavailable — caller stays unauthenticated rather than crash */
  }
}

export async function clearToken() {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch { /* ignore */ }
  // Belt-and-suspenders: remove any legacy plaintext copy too.
  try {
    await AsyncStorage.removeItem(KEY);
  } catch { /* ignore */ }
}
