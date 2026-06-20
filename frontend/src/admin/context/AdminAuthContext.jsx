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

// Decode a JWT's `exp` (seconds) without a library, mirroring the user-side
// AuthContext. An undecodable token counts as expired so a corrupt value is
// dropped rather than trusted. 30s skew so a near-expiry token isn't used for a
// call that 401s mid-flight.
function isAdminTokenExpired(jwt) {
  try {
    const payload = jwt.split(".")[1];
    if (!payload) return true;
    const { exp } = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    if (!exp) return false; // no exp claim → let the server decide
    return exp * 1000 <= Date.now() + 30_000;
  } catch {
    return true;
  }
}

// A stored admin token is only a valid session if it hasn't expired; otherwise
// drop it (and the cached profile) so AdminRoute redirects to /admin/login
// immediately instead of flashing the back-office shell and 401-ing on its
// first API call.
function validStoredAdminToken() {
  const t = adminToken.get();
  if (!t) return null;
  if (isAdminTokenExpired(t)) {
    adminToken.remove();
    userStore.remove();
    return null;
  }
  return t;
}

export function AdminAuthProvider({ children }) {
  const [token, setToken] = useState(() => validStoredAdminToken());
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
