// Global Cosmic Credits balance — a tiny external store read in components via
// useCredits(). Fed by GET /credits and by the `balance` field every AI
// response carries, so the badge stays current without prop-drilling.
// Persisted to sessionStorage so a refresh keeps the last-known value.

const KEY = "astro_credits";
const listeners = new Set();

let balance = (() => {
  const v = sessionStorage.getItem(KEY);
  return v == null ? null : Number(v);
})();

function emit() {
  listeners.forEach((l) => l());
}

export const creditsStore = {
  get: () => balance,
  subscribe: (l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  set(n) {
    if (n == null || Number.isNaN(Number(n))) return;
    balance = Number(n);
    sessionStorage.setItem(KEY, String(balance));
    emit();
  },
  clear() {
    balance = null;
    sessionStorage.removeItem(KEY);
    emit();
  },
};

// Used by the api layer — silently ignores null balances (cache-hit responses
// and plain GETs don't always include one).
export function noteBalance(b) {
  if (b != null) creditsStore.set(b);
}
