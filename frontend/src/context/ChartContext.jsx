import { createContext, useContext, useEffect, useState } from "react";
import { computeChart, CITIES } from "../astrology";

const ChartContext = createContext(null);

// Birth form is persisted here so a page refresh on /reading or /chat keeps
// working instead of bouncing to the home form. Only the form (plain strings)
// is stored — the chart is deterministic and recomputed from it on load, and
// the AI reading/chat are re-fetched from the backend.
const STORAGE_KEY = "astro_form";
const EMPTY_FORM = { name: "", gender: "", date: "", time: "", city: "" };

function loadForm() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || EMPTY_FORM;
  } catch {
    return EMPTY_FORM;
  }
}

// Rebuild the chart from a saved form (chart is fully derived from birth data).
function chartFromForm(form) {
  if (!form?.date || !form?.time || !form?.city) return null;
  const city = CITIES.find(c => c.n === form.city);
  if (!city) return null;
  try {
    return computeChart(form.date, form.time, city);
  } catch {
    return null;
  }
}

export function ChartProvider({ children }) {
  const [form, setForm] = useState(loadForm);
  const [chart, setChart] = useState(() => chartFromForm(loadForm()));
  const [interp, setInterp] = useState(null);
  const [daily, setDaily] = useState(null);
  const [chatMsgs, setChatMsgs] = useState([]);
  const [palm, setPalm] = useState(null);

  // Keep the saved form in sync so it survives a refresh.
  useEffect(() => {
    if (form.date) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  }, [form]);

  const value = {
    form, setForm,
    chart, setChart,
    interp, setInterp,
    daily, setDaily,
    chatMsgs, setChatMsgs,
    palm, setPalm,
  };
  return <ChartContext.Provider value={value}>{children}</ChartContext.Provider>;
}

export function useChart() {
  const ctx = useContext(ChartContext);
  if (!ctx) throw new Error("useChart must be used within a ChartProvider");
  return ctx;
}
