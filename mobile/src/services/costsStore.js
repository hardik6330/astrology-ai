// Per-feature credit prices (from GET /credits). Read in components via
// useCosts() to label "Unlock for N" buttons and cost reminders without
// hardcoding values the admin can change. Mirrors the web store but persists
// to AsyncStorage instead of sessionStorage.

import { getItem, setItem } from "../utils/storage";

const KEY = "astro_costs";
const listeners = new Set();

let costs = null;

getItem(KEY, null).then((v) => {
  if (costs == null && v && typeof v === "object") {
    costs = v;
    emit();
  }
});

function emit() {
  listeners.forEach((l) => l());
}

export const costsStore = {
  get: () => costs,
  subscribe: (l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function noteCosts(c) {
  if (!c || typeof c !== "object") return;
  costs = c;
  setItem(KEY, c);
  emit();
}
