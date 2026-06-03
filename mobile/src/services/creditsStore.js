// Global Cosmic Credits balance — a tiny external store read in components via
// useCredits(). Fed by GET /credits and by the `balance` field every AI
// response carries, so the badge stays current without prop-drilling. Mirrors
// the web store (frontend/src/common/creditsStore.js) but persists to
// AsyncStorage (async) instead of sessionStorage.

import { getItem, setItem, removeItem } from "../utils/storage";

const KEY = "astro_credits";
const listeners = new Set();

let balance = null;

// Best-effort hydrate from disk so a relaunch keeps the last-known value until
// the next GET /credits refresh.
getItem(KEY, null).then((v) => {
  if (balance == null && v != null && !Number.isNaN(Number(v))) {
    balance = Number(v);
    emit();
  }
});

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
    setItem(KEY, balance);
    emit();
  },
  clear() {
    balance = null;
    removeItem(KEY);
    emit();
  },
};

// Used by the api layer — silently ignores null balances (cache-hit responses
// and plain GETs don't always include one).
export function noteBalance(b) {
  if (b != null) creditsStore.set(b);
}
