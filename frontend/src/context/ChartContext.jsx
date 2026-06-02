import { createContext, useContext, useEffect, useState } from "react";
import { computeChart } from "@/shared/astrology";

const ChartContext = createContext(null);

// Birth form is persisted here so a page refresh on /reading or /chat keeps
// working instead of bouncing to the home form. The form now carries the
// resolved lat/lon/tz alongside the city name (no more static-list lookup),
// so the chart can be rebuilt from the form alone.
const STORAGE_KEY = "astro_form";
const EMPTY_FORM = {
  name: "",
  gender: "",
  date: "",
  time: "",
  city: "",
  lat: null,
  lon: null,
  tz: null,
  tzId: null,
  placeId: null,
};

function loadForm() {
  try {
    return { ...EMPTY_FORM, ...JSON.parse(sessionStorage.getItem(STORAGE_KEY)) };
  } catch {
    return EMPTY_FORM;
  }
}

// Rebuild the chart from a saved form (chart is fully derived from birth data).
function chartFromForm(form) {
  if (!form?.date || !form?.time || !form?.city) return null;
  if (form.lat == null || form.lon == null || form.tz == null) return null;
  try {
    return computeChart(form.date, form.time, {
      n: form.city,
      lat: form.lat,
      lon: form.lon,
      tz: form.tz,
    });
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
  // Hand the user claimed for the in-flight analysis — drives the
  // "RIGHT HAND" badge on the scan screen regardless of which page
  // kicked the analysis off.
  const [palmClaimedHand, setPalmClaimedHand] = useState(null);
  // Result of the Both-Hands "Full Life Comparison" — { left, right,
  // comparison }. Separate from `palm` so the single-hand reading isn't
  // overwritten by a comparison, and vice versa.
  const [palmComparison, setPalmComparison] = useState(null);
  // True when the Both-Hands Pro call returned AI_OVERLOADED. PalmPage's
  // compare view reads this and shows the cooldown card with a retry.
  const [palmOverloaded, setPalmOverloaded] = useState(false);
  const [palmLeftPhoto, setPalmLeftPhoto] = useState(null);
  const [palmRightPhoto, setPalmRightPhoto] = useState(null);

  // Keep the saved form in sync so it survives a refresh.
  useEffect(() => {
    if (form.date) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  }, [form]);

  // Hydrate form + chart from server payload (returning user). Persists
  // to sessionStorage so a page refresh on /reading still works.
  function applySavedForm(saved) {
    if (!saved || !saved.date || !saved.time || !saved.city) return;
    const next = {
      name: saved.name || "",
      gender: saved.gender || "",
      date: saved.date,
      time: saved.time,
      city: saved.city,
      lat: saved.lat ?? null,
      lon: saved.lon ?? null,
      tz: saved.tz ?? null,
      tzId: saved.tzId ?? null,
      placeId: saved.placeId ?? null,
    };
    setForm(next);
    setChart(chartFromForm(next));
    setInterp(null);
    setDaily(null);
    setChatMsgs([]);
    setPalm(null);
    setPalmPhoto(null);
    setPalmAnalyzing(false);
    setPalmClaimedHand(null);
    setPalmComparison(null);
    setPalmOverloaded(false);
    setPalmLeftPhoto(null);
    setPalmRightPhoto(null);
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
    setPalmClaimedHand(null);
    setPalmComparison(null);
    setPalmOverloaded(false);
    setPalmLeftPhoto(null);
    setPalmRightPhoto(null);
    sessionStorage.removeItem(STORAGE_KEY);
  }

  const value = {
    form,
    setForm,
    chart,
    setChart,
    interp,
    setInterp,
    daily,
    setDaily,
    chatMsgs,
    setChatMsgs,
    palm,
    setPalm,
    palmPhoto,
    setPalmPhoto,
    palmAnalyzing,
    setPalmAnalyzing,
    palmClaimedHand,
    setPalmClaimedHand,
    palmComparison,
    setPalmComparison,
    palmOverloaded,
    setPalmOverloaded,
    palmLeftPhoto,
    setPalmLeftPhoto,
    palmRightPhoto,
    setPalmRightPhoto,
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
