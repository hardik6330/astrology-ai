// Real Firebase Phone Auth gate. The SMS send + code verification happen on the
// client (see otp.js); this exchanges the resulting Firebase ID token for our
// server-issued JWT via /api/auth/verify-otp.
//
// Note: the force-update gate lives in App.js (AppShell), NOT here.

import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { verifyOtp, bypassLogin, primeAuthPhone, onUnauthorized } from "@/services/api";
import { registerForPush, unregisterForPush } from "@/features/notifications/push";
import { logEvent } from "@/features/notifications/analytics";
import { getToken, setToken as secureSetToken, clearToken } from "@/utils/tokenStore";

const ACC_KEY   = "app_account";
const THEME_KEY = "astro_theme_v1"; // device preference — preserved across logout
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken]     = useState(null);
  const [account, setAccount] = useState(null);
  const [hydrating, setHydrating] = useState(true);

  // Global 401 listener: if any API call returns Unauthorized (token expired),
  // trigger a local logout to bounce the user back to Login.
  useEffect(() => {
    onUnauthorized(() => {
      logout();
    });
  }, [token]);

  // Restore a saved session from disk on boot.
  useEffect(() => {
    (async () => {
      try {
        const [t, a] = await Promise.all([
          getToken(),
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

  // Exchange a verified Firebase ID token for our session JWT.
  async function completeOtpLogin(idToken) {
    return finishLogin(await verifyOtp(idToken));
  }

  // Dev-only OTP bypass: trade a bare E.164 phone for our session JWT, skipping
  // Firebase. Only reachable when EXPO_PUBLIC_OTP_ENABLED='false' (LoginScreen
  // gates the call); the backend rejects it unless its bypass is on too.
  async function completePhoneBypass(phone) {
    return finishLogin(await bypassLogin(phone));
  }

  // Persist the session (without committing) + return commitSession(). The
  // caller hydrates ChartContext first, then calls commitSession() so HomeScreen
  // mounts already knowing whether to redirect a returning user.
  async function finishLogin(data) {
    const { token, account: acc, savedForm = null } = data;
    await secureSetToken(token);
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
    // The session JWT lives in SecureStore now — clear it explicitly (the
    // AsyncStorage sweep below won't touch it).
    await clearToken();
    // Wipe ALL local data so the next user starts completely clean — keeps only
    // the device theme preference. Using getAllKeys catches dynamic per-user
    // keys too (asked_alignments:*, timelineCheck:*) without enumerating them.
    try {
      const keys = await AsyncStorage.getAllKeys();
      const keep = new Set([THEME_KEY]);
      await AsyncStorage.multiRemove(keys.filter((k) => !keep.has(k)));
    } catch {
      await AsyncStorage.multiRemove([ACC_KEY]); // fallback: at least the account blob
    }
    primeAuthPhone(null);
    setToken(null);
    setAccount(null);
  }

  return (
    <AuthContext.Provider
      value={{ token, account, hydrating, completeOtpLogin, completePhoneBypass, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside <AuthProvider>");
  return ctx;
}
