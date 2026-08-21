// Chart memory — the user's Timeline Check answers and which Gochar alignments
// they've already asked about.
//
// The server owns this now (it used to be AsyncStorage-only, so it died on
// reinstall and never crossed devices). AsyncStorage stays as an offline cache
// so the UI still works with no connection; the server wins on hydrate.
//
// Mirrors frontend/src/common/chartMemory.js — keep the two in sync. The only
// difference is that AsyncStorage is async, so the local cache is warmed by
// hydrate() rather than read lazily on each get().

import { getMemory, setMemory } from "./api";
import { getItem, setItem, removeItem } from "../utils/storage";

const INDEX_KEY = "cm:__keys";
const listeners = new Set();
let cache = {};
let hydrated = false;

function emit() {
  listeners.forEach((l) => l());
}

const localKey = (key) => `cm:${key}`;

// AsyncStorage has no "list keys by prefix" we want to depend on, so the set of
// cached keys is tracked explicitly.
async function rememberKey(key) {
  const keys = (await getItem(INDEX_KEY, [])) || [];
  if (!keys.includes(key)) await setItem(INDEX_KEY, [...keys, key]);
}

// Warm from disk, then overlay whatever the server has. Call once per session
// after login. A failure is non-fatal — the local cache keeps working.
export async function hydrate() {
  const keys = (await getItem(INDEX_KEY, [])) || [];
  const local = {};
  for (const k of keys) {
    const v = await getItem(localKey(k), undefined);
    if (v !== undefined && v !== null) local[k] = v;
  }
  cache = local;

  const remote = await getMemory();
  if (remote) {
    cache = { ...local, ...remote }; // server wins
    for (const [k, v] of Object.entries(remote)) {
      await setItem(localKey(k), v);
      await rememberKey(k);
    }
  }
  hydrated = true;
  emit();
}

// Synchronous read — the cache is already in memory after hydrate().
export function get(key, fallback = null) {
  return key in cache ? cache[key] : fallback;
}

// Write through: update locally right away (the UI must not wait on a round
// trip), then push to the server. A failed push leaves the local value — this
// is a user preference, not a ledger, so last-write-wins is fine.
export function set(key, value) {
  cache[key] = value;
  emit();
  setItem(localKey(key), value);
  rememberKey(key);
  setMemory(key, value);
}

export async function reset() {
  const keys = (await getItem(INDEX_KEY, [])) || [];
  await Promise.all(keys.map((k) => removeItem(localKey(k))));
  await removeItem(INDEX_KEY);
  cache = {};
  hydrated = false;
  emit();
}

export const isHydrated = () => hydrated;

export function subscribe(l) {
  listeners.add(l);
  return () => listeners.delete(l);
}
