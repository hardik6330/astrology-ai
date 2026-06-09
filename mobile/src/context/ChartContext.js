import React, {
  createContext, useContext, useEffect, useState, useMemo, useCallback,
} from "react";
import { computeChart } from "../shared/astrology";
import { getItem, setItem, removeItem } from "../utils/storage";
import { creditsStore } from "../services/creditsStore";

// Birth form is persisted to AsyncStorage so app relaunches preserve the
// last-entered chart. The form carries lat/lon/tz alongside the city name,
// so the chart is deterministically rebuildable from the form alone.
//
// State is split across three contexts — Form, Reading, Palm — backed by ONE
// provider that owns all the state. Why one provider but three contexts:
//   • Cross-cutting resets (clearAll, applySavedForm, resetReading) need to
//     touch every slice, which is trivial when all setters share one scope.
//   • But drawer screens stay mounted, so a palm-scan that fires palm state
//     ~per-frame must NOT re-render Reading/Chat/Home. Separate contexts mean
//     a consumer of usePalm() only re-renders on palm changes, useReading()
//     only on reading changes, etc.

const STORAGE_KEY = "astro_form_v1";
const EMPTY_FORM = {
  name: "", gender: "", date: "", time: "",
  city: "", lat: null, lon: null, tz: null, tzId: null, placeId: null,
};

const FormContext = createContext(null);
const ReadingContext = createContext(null);
const PalmContext = createContext(null);

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
  // True when the Both-Hands Pro call was rejected for INSUFFICIENT_CREDITS.
  // Set from the compare flow (which starts on PalmCompareScreen and finishes
  // after navigation), read by PalmScreen to show the "not enough credits" card.
  const [palmLowCredits, setPalmLowCredits] = useState(false);
  const [palmLeftPhoto, setPalmLeftPhoto]   = useState(null);
  const [palmRightPhoto, setPalmRightPhoto] = useState(null);
  // MediaPipe landmarks for the current palmPhoto (for the skeleton overlay).
  // { keypoints: [{x, y}...], imgW, imgH }
  const [palmLandmarks, setPalmLandmarks]   = useState(null);
  const [palmLeftLandmarks, setPalmLeftLandmarks] = useState(null);
  const [palmRightLandmarks, setPalmRightLandmarks] = useState(null);

  // User's live GPS location for daily transits (Rahu Kaal, etc).
  // { n: "Surat", lat: 21.17, lon: 72.83, tz: 5.5, isGps: true }
  const [currentLoc, setCurrentLoc] = useState(null);

  // One-shot flag set right after login when the backend reports the
  // user already has saved birth details. HomeScreen reads it on mount,
  // bounces straight to Reading, then clears it.
  const [redirectToReading, setRedirectToReading] = useState(false);

  // One-time hydration from disk. On cold launch the navigator waits for this
  // to settle (see RootNavigator) before mounting the drawer, so a saved chart
  // makes the drawer open straight on Reading — no Home-form flash, no redirect
  // bounce, and no stale Home left at the bottom of the back history.
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

  // Reset every reading/palm slice (shared by resetReading, clearAll, applySavedForm).
  const clearReadingAndPalm = useCallback(() => {
    setInterp(null);
    setDaily(null);
    setChatMsgs([]);
    setPalm(null);
    setPalmPhoto(null);
    setPalmAnalyzing(false);
    setPalmClaimedHand(null);
    setPalmComparison(null);
    setPalmOverloaded(false);
    setPalmLowCredits(false);
    setPalmLeftPhoto(null);
    setPalmRightPhoto(null);
    setPalmLandmarks(null);
    setPalmLeftLandmarks(null);
    setPalmRightLandmarks(null);
  }, []);

  const resetReading = useCallback(() => {
    clearReadingAndPalm();
  }, [clearReadingAndPalm]);

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
    clearReadingAndPalm();
    setRedirectToReading(true);
    await setItem(STORAGE_KEY, next);
  }, [clearReadingAndPalm]);

  const consumeRedirect = useCallback(() => setRedirectToReading(false), []);

  // Wipe everything — used on logout so a different phone number doesn't
  // see the previous user's chart, readings or palm result.
  const clearAll = useCallback(async () => {
    setForm(EMPTY_FORM);
    setChart(null);
    clearReadingAndPalm();
    creditsStore.clear(); // don't let a new login inherit the previous balance
    await removeItem(STORAGE_KEY);
  }, [clearReadingAndPalm]);

  // ── Slice values ───────────────────────────────────────────────────────
  // Each memo only changes when its own slice does, so consumers re-render
  // narrowly. Setters from useState are stable and don't affect the memo.
  const formValue = useMemo(
    () => ({
      hydrated,
      form, setForm,
      chart, setChart,
      currentLoc, setCurrentLoc,
      redirectToReading, consumeRedirect,
      applySavedForm, clearAll, resetReading,
    }),
    [hydrated, form, chart, currentLoc, redirectToReading, consumeRedirect, applySavedForm, clearAll, resetReading]
  );

  const readingValue = useMemo(
    () => ({
      interp, setInterp,
      daily, setDaily,
      chatMsgs, setChatMsgs,
    }),
    [interp, daily, chatMsgs]
  );

  const palmValue = useMemo(
    () => ({
      palm, setPalm,
      palmPhoto, setPalmPhoto,
      palmAnalyzing, setPalmAnalyzing,
      palmClaimedHand, setPalmClaimedHand,
      palmComparison, setPalmComparison,
      palmOverloaded, setPalmOverloaded,
      palmLowCredits, setPalmLowCredits,
      palmLeftPhoto, setPalmLeftPhoto,
      palmRightPhoto, setPalmRightPhoto,
      palmLandmarks, setPalmLandmarks,
      palmLeftLandmarks, setPalmLeftLandmarks,
      palmRightLandmarks, setPalmRightLandmarks,
    }),
    [palm, palmPhoto, palmAnalyzing, palmClaimedHand, palmComparison, palmOverloaded, palmLowCredits, palmLeftPhoto, palmRightPhoto, palmLandmarks, palmLeftLandmarks, palmRightLandmarks]
  );

  return (
    <FormContext.Provider value={formValue}>
      <ReadingContext.Provider value={readingValue}>
        <PalmContext.Provider value={palmValue}>
          {children}
        </PalmContext.Provider>
      </ReadingContext.Provider>
    </FormContext.Provider>
  );
}

export function useForm() {
  const ctx = useContext(FormContext);
  if (!ctx) throw new Error("useForm must be used within a ChartProvider");
  return ctx;
}

export function useReading() {
  const ctx = useContext(ReadingContext);
  if (!ctx) throw new Error("useReading must be used within a ChartProvider");
  return ctx;
}

export function usePalm() {
  const ctx = useContext(PalmContext);
  if (!ctx) throw new Error("usePalm must be used within a ChartProvider");
  return ctx;
}
