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
  // Data URL of the photo the user uploaded for analysis. Held in memory
  // only (never stored server-side) so the Palm view can show the user
  // which image produced the current reading or rejection.
  const [palmPhoto, setPalmPhoto] = useState(null);
  // True while a background palm analysis is in flight (started on
  // PalmStepPage). PalmPage reads this so opening the tab mid-analysis
  // shows the scan animation instead of an empty card.
  const [palmAnalyzing, setPalmAnalyzing] = useState(false);

  // Keep the saved form in sync so it survives a refresh.
  useEffect(() => {
    if (form.date) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  }, [form]);

  // Hydrate form + chart from server payload (returning user). Persists
  // to sessionStorage so a page refresh on /reading still works.
  function applySavedForm(saved) {
    if (!saved || !saved.date || !saved.time || !saved.city) return;
    const next = {
      name:   saved.name   || "",
      gender: saved.gender || "",
      date:   saved.date,
      time:   saved.time,
      city:   saved.city,
    };
    setForm(next);
    setChart(chartFromForm(next));
    setInterp(null);
    setDaily(null);
    setChatMsgs([]);
    setPalm(null);
    setPalmPhoto(null);
    setPalmAnalyzing(false);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  // Wipe everything — used on logout so a different phone number doesn't
  // inherit the previous user's chart, readings or palm result.
  function clearAll() {
    setForm(EMPTY_FORM);
    setChart(null);
    setInterp(null);
    setDaily(null);
    setChatMsgs([]);
    setPalm(null);
    setPalmPhoto(null);
    setPalmAnalyzing(false);
    sessionStorage.removeItem(STORAGE_KEY);
  }

  const value = {
    form, setForm,
    chart, setChart,
    interp, setInterp,
    daily, setDaily,
    chatMsgs, setChatMsgs,
    palm, setPalm,
    palmPhoto, setPalmPhoto,
    palmAnalyzing, setPalmAnalyzing,
    clearAll,
    applySavedForm,
  };
  return <ChartContext.Provider value={value}>{children}</ChartContext.Provider>;
}

export function useChart() {
  const ctx = useContext(ChartContext);
  if (!ctx) throw new Error("useChart must be used within a ChartProvider");
  return ctx;
}
