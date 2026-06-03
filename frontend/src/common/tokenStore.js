// Tiny typed wrapper around a single localStorage key. Centralizes the
// get/set/remove plumbing that was inlined wherever a bearer token is stored.
//
//   const adminToken = tokenStore("admin_token");
//   adminToken.set(jwt); adminToken.get(); adminToken.remove();

export function tokenStore(key) {
  return {
    get: () => localStorage.getItem(key),
    set: (value) => localStorage.setItem(key, value),
    remove: () => localStorage.removeItem(key),
  };
}
