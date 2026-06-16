// Real Firebase Phone Auth gate. The SMS send + code verification happen on the
// client (see otp.js); this exchanges the resulting Firebase ID token for our
// server-issued JWT via /api/auth/verify-otp.

import React, { createContext, useContext, useEffect, useState } from "react";
import { Linking, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { verifyOtp, dummyLogin, primeAuthPhone, onUnauthorized, getAuthConfig } from "@/services/api";
import { registerForPush, unregisterForPush } from "@/features/notifications/push";
import { logEvent } from "@/features/notifications/analytics";
import UpdateModal from "@/components/UpdateModal";

const KEY     = "app_token";
const ACC_KEY = "app_account";
const AuthContext = createContext(null);

// Store-listing redirect for force-update. No admin-configured URL anymore — the
// link is derived from this app's own package id, so it always points at the
// correct listing. iOS needs the numeric App Store id (fill once it exists).
const ANDROID_PKG = Constants.expoConfig?.android?.package || "com.astrologyai.app";
const IOS_APP_ID  = ""; // e.g. "1234567890" once the App Store listing is live

export function AuthProvider({ children }) {
  const [token, setToken]     = useState(null);
  const [account, setAccount] = useState(null);
  const [hydrating, setHydrating] = useState(true);
  const [updateRequired, setUpdateRequired] = useState(null); // { latestVersion }

  // Global 401 listener: if any API call returns Unauthorized (token expired),
  // trigger a local logout to bounce the user back to Login.
  useEffect(() => {
    onUnauthorized(() => {
      logout();
    });
  }, [token]);

  useEffect(() => {
    (async () => {
      try {
        // 1. Check for Force Update first
        const config = await getAuthConfig();
        const currentVersion = Constants.expoConfig?.version || "1.0.0";
        
        if (config.appConfig?.forceUpdate && config.appConfig?.latestVersion) {
          if (isVersionOlder(currentVersion, config.appConfig.latestVersion)) {
            setUpdateRequired({
              latestVersion: config.appConfig.latestVersion,
            });
            // If it's a force update, we stop hydrating and show the modal
            return;
          }
        }

        // 2. Normal hydration
        const [t, a] = await Promise.all([
          AsyncStorage.getItem(KEY),
          AsyncStorage.getItem(ACC_KEY),
        ]);
        if (t) setToken(t);
        if (a) {
          const acc = JSON.parse(a);
          setAccount(acc);
          primeAuthPhone(acc?.phone);
        }
        if (t) registerForPush();
      } catch { /* ignore */ }
      finally { setHydrating(false); }
    })();
  }, []);

  // Simple semantic version comparison (e.g., "1.0.0" < "1.0.1")
  function isVersionOlder(current, latest) {
    const c = current.split(".").map(Number);
    const l = latest.split(".").map(Number);
    for (let i = 0; i < 3; i++) {
      if ((l[i] || 0) > (c[i] || 0)) return true;
      if ((l[i] || 0) < (c[i] || 0)) return false;
    }
    return false;
  }

  // Open this app's store listing directly. The market:// / itms-apps:// scheme
  // launches the native store app; if it can't resolve (e.g. Play Store app
  // missing) we fall back to the https listing in a browser.
  const openStore = () => {
    const deep = Platform.OS === "ios"
      ? `itms-apps://apps.apple.com/app/id${IOS_APP_ID}`
      : `market://details?id=${ANDROID_PKG}`;
    const web = Platform.OS === "ios"
      ? `https://apps.apple.com/app/id${IOS_APP_ID}`
      : `https://play.google.com/store/apps/details?id=${ANDROID_PKG}`;
    Linking.openURL(deep).catch(() => Linking.openURL(web));
  };

  // Exchange a verified Firebase ID token for our session JWT (real OTP mode).
  async function completeOtpLogin(idToken) {
    return finishLogin(await verifyOtp(idToken));
  }

  // Dummy login — used when EXPO_PUBLIC_OTP_SERVICE is OFF. Trades a bare phone
  // for our JWT, no SMS.
  async function loginDummy(phone) {
    return finishLogin(await dummyLogin(phone));
  }

  // Persist the session (without committing) + return commitSession(). The
  // caller hydrates ChartContext first, then calls commitSession() so HomeScreen
  // mounts already knowing whether to redirect a returning user.
  async function finishLogin(data) {
    const { token, account: acc, savedForm = null } = data;
    await AsyncStorage.setItem(KEY, token);
    await AsyncStorage.setItem(ACC_KEY, JSON.stringify(acc));
    primeAuthPhone(acc.phone);
    logEvent("login", { phone: acc.phone });
    return {
      savedForm,
      commitSession: () => {
        setToken(token);
        setAccount(acc);
        // Register this device for push now that we have a real account/JWT.
        registerForPush();
      },
    };
  }

  async function logout() {
    logEvent("logout", { phone: account?.phone });
    // Disable the push token server-side BEFORE clearing the JWT — the
    // unregister call needs the token to authenticate.
    await unregisterForPush();
    await AsyncStorage.multiRemove([KEY, ACC_KEY]);
    primeAuthPhone(null);
    setToken(null);
    setAccount(null);
  }

  return (
    <AuthContext.Provider value={{ token, account, hydrating, completeOtpLogin, loginDummy, logout }}>
      {children}
      {/* Force-update gate: when the backend flags forceUpdate and this client is
          older than app_latest_version, show a non-dismissible modal whose only
          action redirects straight to this app's store listing. */}
      <UpdateModal
        visible={!!updateRequired}
        mandatory
        latestVersion={updateRequired?.latestVersion}
        onUpdate={openStore}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside <AuthProvider>");
  return ctx;
}
