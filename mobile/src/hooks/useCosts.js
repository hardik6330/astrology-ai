import { useSyncExternalStore } from "react";
import { costsStore } from "../services/costsStore";

// Per-feature credit costs ({ insights, chat, daily, palm }) or null until known.
export function useCosts() {
  return useSyncExternalStore(costsStore.subscribe, costsStore.get, costsStore.get);
}
