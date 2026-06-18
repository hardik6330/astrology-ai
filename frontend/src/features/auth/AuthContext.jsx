// Real Firebase Phone Auth gate. The SMS send + code verification happen on the
// client (see webOtp.js); here we take the resulting Firebase ID token, hand it
// to /api/auth/verify-otp, and store the backend-issued JWT.

import { createContext, useContext, useEffect, useState } from "react";
import { tokenStore } from "@/common/tokenStore";
import { verifyOtp } from "@/services/api";
import { registerForWebPush, teardownWebPush } from "@/features/notifications/webPush";

// appToken (the bearer) is shared with services/api.js; appAccount holds the
// cached account JSON.
const appToken = tokenStore("app_token");
const appAccount = tokenStore("app_account");
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => appToken.get());
  const [account, setAccount] = useState(() => {
    try {
      return JSON.parse(appAccount.get() || "null");
    } catch {
      return null;
    }
  });

  // Already signed in from a prior session — register the web push token on
  // launch (covers permission changes / token rotation while away).
  useEffect(() => {
    if (token) registerForWebPush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Exchange a verified Firebase ID token for our session JWT via
  // /api/auth/verify-otp. Returns any savedForm so the caller can hydrate
  // ChartContext and route a returning user straight to their kundali.
  // Throws on a backend/verification failure (caller surfaces the message).
  async function completeOtpLogin(idToken) {
    const data = await verifyOtp(idToken); // { token, account, savedForm? }
    return finishLogin(data);
  }

  // Persist the session + register push.
  function finishLogin(data) {
    appToken.set(data.token);
    appAccount.set(JSON.stringify(data.account));
    setToken(data.token);
    setAccount(data.account);
    registerForWebPush();
    return { savedForm: data.savedForm || null };
  }

  function logout() {
    teardownWebPush();
    // Wipe ALL local data so the next user starts completely clean — keeps only
    // the separate admin back-office session. Catches dynamic per-user keys too
    // (asked_alignments:*, timelineCheck:*) without enumerating them.
    try {
      Object.keys(localStorage)
        .filter((k) => k !== "admin_token")
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      appToken.remove();
      appAccount.remove(); // fallback: at least clear the session
    }
    setToken(null);
    setAccount(null);
  }

  return (
    <AuthContext.Provider value={{ token, account, hydrating: false, completeOtpLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside <AuthProvider>");
  return ctx;
}
