// Dummy auth gate — no Firebase, no backend verification yet. We only
// persist a placeholder token in AsyncStorage so the navigator can decide
// between Login and Main. Swap in real verification later by changing
// `login()` to call /api/auth/verify-otp.

import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { primeAuthPhone } from "../services/api";

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
    const fakeToken = `dummy.${Date.now()}`;
    const acc = { phone };
    await AsyncStorage.setItem(KEY, fakeToken);
    await AsyncStorage.setItem(ACC_KEY, JSON.stringify(acc));
    primeAuthPhone(phone);
    setToken(fakeToken);
    setAccount(acc);
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
