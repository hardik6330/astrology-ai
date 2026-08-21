import { useCallback, useSyncExternalStore } from "react";
import * as chartMemory from "../services/chartMemory";

// One remembered value, re-rendering when the server hydration lands so an
// answer given on another device shows up without a restart.
export function useChartMemory(key, fallback = null) {
  const value = useSyncExternalStore(
    chartMemory.subscribe,
    () => (key ? chartMemory.get(key, fallback) : fallback),
    () => fallback,
  );
  const setValue = useCallback((v) => key && chartMemory.set(key, v), [key]);
  return [value, setValue, chartMemory.isHydrated()];
}
