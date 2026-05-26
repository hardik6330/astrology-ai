import React, {
  createContext, useContext, useEffect, useState, useMemo, useCallback,
} from "react";
import { computeChart, CITIES } from "../shared/astrology";
import { getItem, setItem } from "../utils/storage";

// Birth form is persisted to AsyncStorage so app relaunches preserve the
// last-entered chart. Only the plain form is stored — the chart itself is
// deterministically recomputed from it on load (and AI readings are
// re-fetched from the backend on demand).

const STORAGE_KEY = "astro_form_v1";
const EMPTY_FORM = { name: "", gender: "", date: "", time: "", city: "" };

const ChartContext = createContext(null);

function chartFromForm(form) {
  if (!form?.date || !form?.time || !form?.city) return null;
  const city = CITIES.find((c) => c.n === form.city);
  if (!city) return null;
  try {
    return computeChart(form.date, form.time, city);
  } catch {
    return null;
  }
}

export function ChartProvider({ children }) {
  const [hydrated, setHydrated] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [chart, setChart] = useState(null);
  const [interp, setInterp] = useState(null);
  const [daily, setDaily] = useState(null);
  const [chatMsgs, setChatMsgs] = useState([]);
  const [palm, setPalm] = useState(null);

  // One-time hydration from disk.
  useEffect(() => {
    (async () => {
      const saved = await getItem(STORAGE_KEY, EMPTY_FORM);
      setForm(saved);
      setChart(chartFromForm(saved));
      setHydrated(true);
    })();
  }, []);

  // Persist form changes (only once we've hydrated, to avoid stomping disk
  // with the EMPTY_FORM during the first render).
  useEffect(() => {
    if (!hydrated) return;
    if (form.date) setItem(STORAGE_KEY, form);
  }, [form, hydrated]);

  const resetReading = useCallback(() => {
    setInterp(null);
    setDaily(null);
    setChatMsgs([]);
  }, []);

  const value = useMemo(
    () => ({
      hydrated,
      form, setForm,
      chart, setChart,
      interp, setInterp,
      daily, setDaily,
      chatMsgs, setChatMsgs,
      palm, setPalm,
      resetReading,
    }),
    [hydrated, form, chart, interp, daily, chatMsgs, palm, resetReading]
  );

  return <ChartContext.Provider value={value}>{children}</ChartContext.Provider>;
}

export function useChart() {
  const ctx = useContext(ChartContext);
  if (!ctx) throw new Error("useChart must be used within a ChartProvider");
  return ctx;
}
