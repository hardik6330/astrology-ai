import { createContext, useContext, useEffect, useRef, useState } from "react";
import { computeChart, buildFactSheet } from "@/shared/astrology";
import { creditsStore } from "@/common/creditsStore";
import { tokenStore } from "@/common/tokenStore";
import { getMe, chatCompletionJSON, fetchSaved } from "@/services/api";

const ChartContext = createContext(null);

// Shared with the auth context — lets us tell "logged in" from "logged out"
// without importing AuthContext (avoids a provider-ordering coupling).
const appToken = tokenStore("app_token");

// Birth form is persisted in localStorage (like the auth token) so a page
// refresh OR a full browser close+reopen keeps working instead of bouncing to
// the home form. The form carries the resolved lat/lon/tz alongside the city
// name, so the chart rebuilds from the form alone — no server round-trip.
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
    return { ...EMPTY_FORM, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
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
  // Insight (detailed reading) generation lifecycle lives in context — not in
  // ReadingPage — so an in-flight generation keeps running and its loading /
  // result state survives the user navigating to another tab/page and back
  // (same pattern as the palm `palmAnalyzing` flag below).
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightOverloaded, setInsightOverloaded] = useState(false); // AI tried 3× and gave up
  const [insightLowCredits, setInsightLowCredits] = useState(false); // 402 on unlock
  const [insightError, setInsightError] = useState("");
  const insightInFlight = useRef(false); // hard guard against a double-trigger
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
  // MediaPipe hand landmarks from the upload-time gate — { keypoints, imgW,
  // imgH }. Held in memory only, used to draw the hand-skeleton overlay on the
  // scan animation. Null when the gate didn't surface them (model/decode fail).
  const [palmLandmarks, setPalmLandmarks] = useState(null);
  // Result of the Both-Hands "Full Life Comparison" — { left, right,
  // comparison }. Separate from `palm` so the single-hand reading isn't
  // overwritten by a comparison, and vice versa.
  const [palmComparison, setPalmComparison] = useState(null);
  // True when the Both-Hands Pro call returned AI_OVERLOADED. PalmPage's
  // compare view reads this and shows the cooldown card with a retry.
  const [palmOverloaded, setPalmOverloaded] = useState(false);
  // True when the Both-Hands Pro call was rejected for INSUFFICIENT_CREDITS.
  // Set from the compare flow (which may start on PalmComparePage and finish
  // after navigation), read by PalmPage to show the "not enough credits" card.
  const [palmLowCredits, setPalmLowCredits] = useState(false);
  const [palmLeftPhoto, setPalmLeftPhoto] = useState(null);
  const [palmRightPhoto, setPalmRightPhoto] = useState(null);

  // Cross-device fallback: the form now persists locally (localStorage), so a
  // reopen on the SAME browser rebuilds the chart with no server call. But on a
  // NEW browser/device the user is logged in (token) yet has no local form — in
  // that case pull the saved form from the server before routing, so they still
  // land on their reading. Guards wait on this flag to avoid a form flash.
  const [hydrating, setHydrating] = useState(() => !loadForm().date && !!appToken.get());

  // Keep the saved form in sync so it survives a refresh.
  useEffect(() => {
    if (form.date) localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  }, [form]);

  // One-shot startup hydration (see `hydrating` above).
  useEffect(() => {
    if (!hydrating) return;
    let cancelled = false;
    getMe()
      .then((data) => {
        if (!cancelled && data?.savedForm) applySavedForm(data.savedForm);
      })
      .catch(() => {}) // no saved form / offline → user just sees the form
      .finally(() => {
        if (!cancelled) setHydrating(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    insightInFlight.current = false;
    setInsightLoading(false);
    setInsightOverloaded(false);
    setInsightLowCredits(false);
    setInsightError("");
    setDaily(null);
    setChatMsgs([]);
    setPalm(null);
    setPalmPhoto(null);
    setPalmAnalyzing(false);
    setPalmClaimedHand(null);
    setPalmLandmarks(null);
    setPalmComparison(null);
    setPalmOverloaded(false);
    setPalmLowCredits(false);
    setPalmLeftPhoto(null);
    setPalmRightPhoto(null);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  // Generate (and pay for) the detailed AI interpretation. User-initiated via
  // the "Unlock" button on ReadingPage, but owned here so it survives navigation
  // — if the user leaves the reading tab mid-generation, the request keeps
  // running and the result lands in `interp` whenever it resolves. The in-flight
  // ref makes a repeat trigger (e.g. re-clicking after coming back) a no-op.
  async function generateInsight() {
    if (!chart || insightInFlight.current) return;
    insightInFlight.current = true;
    setInsightError("");
    setInsightLowCredits(false);
    setInsightOverloaded(false);
    setInsightLoading(true);
    try {
      // Already unlocked for this chart? The GET returns it for free.
      const saved = await fetchSaved("interpret", form);
      setInterp(
        saved || (await chatCompletionJSON([], "interpret", { factSheet: buildFactSheet(chart, form), form }))
      );
    } catch (e) {
      if (e.code === "AI_OVERLOADED") setInsightOverloaded(true);
      else if (e.code === "INSUFFICIENT_CREDITS") setInsightLowCredits(true);
      else setInsightError(e.message);
    } finally {
      setInsightLoading(false);
      insightInFlight.current = false;
    }
  }

  // Wipe everything — used on logout so a different phone number doesn't
  // inherit the previous user's chart, readings or palm result.
  function clearAll() {
    setForm(EMPTY_FORM);
    setChart(null);
    setInterp(null);
    insightInFlight.current = false;
    setInsightLoading(false);
    setInsightOverloaded(false);
    setInsightLowCredits(false);
    setInsightError("");
    setDaily(null);
    setChatMsgs([]);
    setPalm(null);
    setPalmPhoto(null);
    setPalmAnalyzing(false);
    setPalmClaimedHand(null);
    setPalmLandmarks(null);
    setPalmComparison(null);
    setPalmOverloaded(false);
    setPalmLowCredits(false);
    setPalmLeftPhoto(null);
    setPalmRightPhoto(null);
    creditsStore.clear(); // don't let a new login inherit the previous balance
    localStorage.removeItem(STORAGE_KEY);
  }

  const value = {
    hydrating,
    form,
    setForm,
    chart,
    setChart,
    interp,
    setInterp,
    insightLoading,
    insightOverloaded,
    insightLowCredits,
    insightError,
    setInsightError,
    setInsightLowCredits,
    generateInsight,
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
    palmLandmarks,
    setPalmLandmarks,
    palmComparison,
    setPalmComparison,
    palmOverloaded,
    setPalmOverloaded,
    palmLowCredits,
    setPalmLowCredits,
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
