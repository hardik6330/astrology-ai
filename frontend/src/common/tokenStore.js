// Tiny typed wrapper around a single localStorage key. Centralizes the
// get/set/remove plumbing that was inlined wherever a bearer token is stored.
//
//   const adminToken = tokenStore("admin_token");
//   adminToken.set(jwt); adminToken.get(); adminToken.remove();

export function tokenStore(key) {
  let cache = undefined;

  return {
    get: () => {
      if (cache === undefined) {
        cache = localStorage.getItem(key);
      }
      return cache;
    },
    set: (value) => {
      cache = value;
      localStorage.setItem(key, value);
    },
    remove: () => {
      cache = null;
      localStorage.removeItem(key);
    },
  };
}
