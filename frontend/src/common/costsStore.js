// Per-feature credit prices (from GET /credits). Read in components via
// useCosts() to label "Unlock for N" buttons and cost reminders without
// hardcoding values the admin can change.

const KEY = "astro_costs";
const listeners = new Set();

let costs = (() => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
})();

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
  sessionStorage.setItem(KEY, JSON.stringify(c));
  emit();
}
