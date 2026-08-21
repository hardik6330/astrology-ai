// Chart memory — the user's Timeline Check answers and which Gochar alignments
// they've already asked about.
//
// The server owns this now (it used to be localStorage-only, so it died on
// reinstall and never crossed devices). localStorage stays as an offline cache
// so reads are synchronous on first paint and the UI still works offline; the
// server is the source of truth and wins on hydrate.
//
// Mirrors mobile/src/services/chartMemory.js — keep the two in sync.

import { getMemory, setMemory } from "@/services/api";

const listeners = new Set();
let cache = {};
let hydrated = false;

function emit() {
  listeners.forEach((l) => l());
}

function localKey(key) {
  return `cm:${key}`;
}

function readLocal(key) {
  try {
    const raw = localStorage.getItem(localKey(key));
    return raw == null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

// Pull everything the account remembers. Call once per session after login.
// A failure is non-fatal — the local cache keeps working.
export async function hydrate() {
  const remote = await getMemory();
  if (remote) {
    cache = remote;
    for (const [k, v] of Object.entries(remote)) {
      try {
        localStorage.setItem(localKey(k), JSON.stringify(v));
      } catch {
        /* quota / private mode — the in-memory cache still holds */
      }
    }
  }
  hydrated = true;
  emit();
}

// Synchronous read: in-memory first, then the local cache, then the fallback.
// The local read is memoised INTO the cache on purpose — useSyncExternalStore
// compares snapshots by reference, and re-parsing JSON on every render would
// hand back a fresh object each time and spin forever.
export function get(key, fallback = null) {
  if (!(key in cache)) {
    const local = readLocal(key);
    if (local !== undefined) cache[key] = local;
  }
  return key in cache ? cache[key] : fallback;
}

// Write through: update locally right away (the UI must not wait on a round
// trip), then push to the server. A failed push leaves the local value — this
// is a user preference, not a ledger, so last-write-wins is fine.
export function set(key, value) {
  cache[key] = value;
  try {
    localStorage.setItem(localKey(key), JSON.stringify(value));
  } catch {
    /* best-effort */
  }
  emit();
  setMemory(key, value);
}

export function reset() {
  cache = {};
  hydrated = false;
  emit();
}

export const isHydrated = () => hydrated;

export function subscribe(l) {
  listeners.add(l);
  return () => listeners.delete(l);
}
