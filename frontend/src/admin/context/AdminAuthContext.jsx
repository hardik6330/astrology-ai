// Admin session state — entirely separate from the phone-OTP user auth. The
// token + admin profile live under their own localStorage keys so an admin
// session never collides with a logged-in app user in the same browser.

import { createContext, useContext, useState } from "react";
import { tokenStore } from "@/common/tokenStore";
import { adminLogin, adminToken } from "@/admin/api/adminApi";

// adminToken (the bearer) is shared with adminApi; the cached profile JSON has
// its own key here.
const userStore = tokenStore("admin_user");
const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [token, setToken] = useState(() => adminToken.get());
  const [admin, setAdmin] = useState(() => {
    try {
      return JSON.parse(userStore.get() || "null");
    } catch {
      return null;
    }
  });

  async function login(username, password) {
    const data = await adminLogin(username, password);
    adminToken.set(data.token);
    userStore.set(JSON.stringify(data.admin));
    setToken(data.token);
    setAdmin(data.admin);
    return data;
  }

  function logout() {
    adminToken.remove();
    userStore.remove();
    setToken(null);
    setAdmin(null);
  }

  return (
    <AdminAuthContext.Provider value={{ token, admin, login, logout }}>{children}</AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
