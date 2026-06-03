import { useSyncExternalStore } from "react";
import { creditsStore } from "../services/creditsStore";

// Current credit balance (number), or null until first known.
export function useCredits() {
  return useSyncExternalStore(creditsStore.subscribe, creditsStore.get, creditsStore.get);
}
