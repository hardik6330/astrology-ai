// Dummy auth gate — no Firebase, no backend verification. We only store a
// placeholder token in localStorage so the router can decide between
// LoginPage and the rest of the app. Swap in real verification later by
// changing `login()` to call /api/auth/verify-otp.

import { createContext, useContext, useState } from "react";

const KEY = "app_token";
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken]     = useState(() => localStorage.getItem(KEY));
  const [account, setAccount] = useState(() => {
    try { return JSON.parse(localStorage.getItem("app_account") || "null"); }
    catch { return null; }
  });

  function login({ phone }) {
    const fakeToken = `dummy.${Date.now()}`;
    const acc = { phone };
    localStorage.setItem(KEY, fakeToken);
    localStorage.setItem("app_account", JSON.stringify(acc));
    setToken(fakeToken);
    setAccount(acc);
  }

  function logout() {
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
