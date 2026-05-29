import React, {
  createContext, useContext, useEffect, useState, useMemo, useCallback,
} from "react";
import { computeChart } from "../shared/astrology";
import { getItem, setItem, removeItem } from "../utils/storage";

// Birth form is persisted to AsyncStorage so app relaunches preserve the
// last-entered chart. The form carries lat/lon/tz alongside the city name,
// so the chart is deterministically rebuildable from the form alone.

const STORAGE_KEY = "astro_form_v1";
const EMPTY_FORM = {
  name: "", gender: "", date: "", time: "",
  city: "", lat: null, lon: null, tz: null, tzId: null, placeId: null,
};

const ChartContext = createContext(null);

function chartFromForm(form) {
  if (!form?.date || !form?.time || !form?.city) return null;
  if (form.lat == null || form.lon == null || form.tz == null) return null;
  try {
    return computeChart(form.date, form.time, {
      n: form.city, lat: form.lat, lon: form.lon, tz: form.tz,
    });
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
  // URI of the photo the user picked for analysis. In-memory only (never
  // persisted) so the Palm screen can show which photo a reading or
  // rejection corresponds to.
  const [palmPhoto, setPalmPhoto] = useState(null);
  // True while a background palm analysis (started on PalmStepScreen) is
  // running. PalmScreen uses this to show the scan animation when opened
  // mid-flight instead of an empty card.
  const [palmAnalyzing, setPalmAnalyzing] = useState(false);
  // Hand the user claimed for the in-flight analysis — drives the
  // "RIGHT HAND" badge on the scan screen regardless of which screen
  // kicked the analysis off.
  const [palmClaimedHand, setPalmClaimedHand] = useState(null);
  // Both-Hands "Full Life Comparison" — { left, right, comparison }.
  const [palmComparison, setPalmComparison] = useState(null);
  // True when the Both-Hands Pro call returned AI_OVERLOADED — drives the
  // cooldown card on PalmScreen.
  const [palmOverloaded, setPalmOverloaded] = useState(false);
  const [palmLeftPhoto, setPalmLeftPhoto]   = useState(null);
  const [palmRightPhoto, setPalmRightPhoto] = useState(null);

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
    setPalm(null);
    setPalmPhoto(null);
    setPalmAnalyzing(false);
    setPalmClaimedHand(null);
    setPalmComparison(null);
    setPalmOverloaded(false);
    setPalmLeftPhoto(null);
    setPalmRightPhoto(null);
  }, []);

  // One-shot flag set right after login when the backend reports the
  // user already has saved birth details. HomeScreen reads it on mount,
  // bounces straight to Reading, then clears it.
  const [redirectToReading, setRedirectToReading] = useState(false);

  // Hydrate form + chart from a saved server payload (returning user).
  // Persists the form to disk so a relaunch still skips the home step.
  const applySavedForm = useCallback(async (saved) => {
    if (!saved || !saved.date || !saved.time || !saved.city) return;
    const next = {
      name:    saved.name    || "",
      gender:  saved.gender  || "",
      date:    saved.date,
      time:    saved.time,
      city:    saved.city,
      lat:     saved.lat     ?? null,
      lon:     saved.lon     ?? null,
      tz:      saved.tz      ?? null,
      tzId:    saved.tzId    ?? null,
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
    setRedirectToReading(true);
    await setItem(STORAGE_KEY, next);
  }, []);

  const consumeRedirect = useCallback(() => setRedirectToReading(false), []);

  // Wipe everything — used on logout so a different phone number doesn't
  // see the previous user's chart, readings or palm result.
  const clearAll = useCallback(async () => {
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
    await removeItem(STORAGE_KEY);
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
      palmPhoto, setPalmPhoto,
      palmAnalyzing, setPalmAnalyzing,
      palmClaimedHand, setPalmClaimedHand,
      palmComparison, setPalmComparison,
      palmOverloaded, setPalmOverloaded,
      palmLeftPhoto, setPalmLeftPhoto,
      palmRightPhoto, setPalmRightPhoto,
      resetReading,
      clearAll,
      applySavedForm,
      redirectToReading,
      consumeRedirect,
    }),
    [hydrated, form, chart, interp, daily, chatMsgs, palm, palmPhoto, palmAnalyzing, palmClaimedHand, palmComparison, palmOverloaded, palmLeftPhoto, palmRightPhoto, resetReading, clearAll, applySavedForm, redirectToReading, consumeRedirect]
  );

  return <ChartContext.Provider value={value}>{children}</ChartContext.Provider>;
}

export function useChart() {
  const ctx = useContext(ChartContext);
  if (!ctx) throw new Error("useChart must be used within a ChartProvider");
  return ctx;
}
