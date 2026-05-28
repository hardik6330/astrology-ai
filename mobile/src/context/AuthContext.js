// Dummy auth gate — talks to backend's /api/auth/dummy-login so that
// every phone number becomes a real AuthAccount row in MySQL with a
// proper server-issued JWT. Swap to /api/auth/verify-otp (real Firebase)
// later by changing only the `login()` body below.

import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { dummyLogin, primeAuthPhone } from "../services/api";

const KEY     = "app_token";
const ACC_KEY = "app_account";
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken]     = useState(null);
  const [account, setAccount] = useState(null);
  const [hydrating, setHydrating] = useState(true);

  useEffect(() => {
    (async () => {
      try {
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
      } catch { /* ignore */ }
      finally { setHydrating(false); }
    })();
  }, []);

  async function login({ phone }) {
    // Backend findOrCreates the AuthAccount keyed on phone and returns a
    // real server-issued JWT plus (when present) the user's saved birth
    // details — so a returning user can land directly on Reading.
    let token, acc, savedForm = null;
    try {
      const data = await dummyLogin(phone);
      token = data.token;
      acc = data.account;
      savedForm = data.savedForm || null;
    } catch {
      token = `dummy.${Date.now()}`;
      acc = { phone };
    }
    await AsyncStorage.setItem(KEY, token);
    await AsyncStorage.setItem(ACC_KEY, JSON.stringify(acc));
    primeAuthPhone(acc.phone);
    // Return the credentials without committing them — the caller hydrates
    // ChartContext first, then calls commitSession() so HomeScreen mounts
    // already knowing whether to redirect a returning user.
    return {
      savedForm,
      commitSession: () => { setToken(token); setAccount(acc); },
    };
  }

  async function logout() {
    await AsyncStorage.multiRemove([KEY, ACC_KEY]);
    primeAuthPhone(null);
    setToken(null);
    setAccount(null);
  }

  return (
    <AuthContext.Provider value={{ token, account, hydrating, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside <AuthProvider>");
  return ctx;
}
