// Dummy auth gate — no Firebase, no backend verification. We only store a
// placeholder token in localStorage so the router can decide between
// LoginPage and the rest of the app. Swap in real verification later by
// changing `login()` to call /api/auth/verify-otp.

import { createContext, useContext, useEffect, useState } from "react";
import { dummyLogin } from "@/services/api";
import { registerForWebPush, teardownWebPush } from "@/features/notifications/webPush";

const KEY = "app_token";
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(KEY));
  const [account, setAccount] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("app_account") || "null");
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

  // Calls backend /auth/dummy-login. On success returns any savedForm so
  // the caller can hydrate ChartContext and route the user straight to
  // their kundali. Falls back to a local-only session on network failure.
  async function login({ phone }) {
    let tok,
      acc,
      savedForm = null;
    try {
      const data = await dummyLogin(phone);
      tok = data.token;
      acc = data.account;
      savedForm = data.savedForm || null;
    } catch {
      tok = `dummy.${Date.now()}`;
      acc = { phone };
    }
    localStorage.setItem(KEY, tok);
    localStorage.setItem("app_account", JSON.stringify(acc));
    setToken(tok);
    setAccount(acc);
    // Register this browser for push now that we have a real account + JWT.
    registerForWebPush();
    return { savedForm };
  }

  function logout() {
    teardownWebPush();
    localStorage.removeItem(KEY);
    localStorage.removeItem("app_account");
    setToken(null);
    setAccount(null);
  }

  return (
    <AuthContext.Provider value={{ token, account, hydrating: false, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside <AuthProvider>");
  return ctx;
}
