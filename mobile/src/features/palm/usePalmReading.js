import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { useForm, usePalm } from "../../context/ChartContext";
import { useCosts } from "../../hooks/useCosts";
import { useCredits } from "../../hooks/useCredits";
import { analyzePalm, fetchSaved, fetchPalmHistory, fetchPalmById } from "../../services/api";
import { gatePalmImage, warmUpGate, ensureGate } from "./palmGate";
import { haptics } from "../../utils/haptics";
import { logEvent } from "../../features/notifications/analytics";
import { compressPhoto } from "../../utils/compressImage";
import { SCAN_MSGS } from "./constants";

// We wait for the gate MODEL to load (one-time) before scanning so the gate
// reliably produces the landmarks the biometric match needs, rather than racing
// a timeout that drops them. Inference is fast once the model is warm. Only a
// genuine load failure (beyond MODEL_READY_TIMEOUT_MS) falls back to the backend gate.
const MODEL_READY_TIMEOUT_MS = 25000;
const GATE_INFER_TIMEOUT_MS = 8000;

// Resolve `promise`, or reject with a timeout error after `ms`.
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("gate timeout")), ms)),
  ]);
}

// All of PalmScreen's state, effects, and handlers. Keeping it here lets the
// screen stay a thin render layer — the single-hand flow has a lot of moving
// parts (gate → analyze → result, plus background analyses started on other
// screens that this screen has to mirror).
export function usePalmReading() {
  const { form } = useForm();
  const {
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
  } = usePalm();
  const costs = useCosts();
  const palmCost = costs?.palm ?? 30;
  const credits = useCredits();
  // Single-hand 402 flag (local); compare 402 lives in context (palmLowCredits)
  // because that flow finishes after a screen navigation.
  const [lowCredits, setLowCredits] = useState(false);
  // Can't afford a palm reading — balance already too low, or a single/compare
  // attempt came back 402. Drives the card + disables every scan button.
  const cannotAfford = lowCredits || palmLowCredits || (credits != null && credits < palmCost);
  // Mirror context.palmPhoto so a photo uploaded on PalmStepScreen still
  // shows up here (the screen unmounts in between).
  const [preview, setPreview]   = useState(palmPhoto ? { uri: palmPhoto } : null);
  // Mirror palmAnalyzing so a background analysis started elsewhere drives
  // the scan animation here when the user opens this screen.
  const [scanning, setScanning] = useState(palmAnalyzing);
  // True while the client-side MediaPipe gate is checking the just-picked
  // photo (1–3s). Mirrors PalmStepScreen's loading state so the user sees
  // feedback between picker close and the scan animation starting.
  const [gating, setGating] = useState(false);
  const [scanMsg, setScanMsg]   = useState(SCAN_MSGS[0]);
  const [error, setError]       = useState("");
  const [overloaded, setOverloaded] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [rescan, setRescan]     = useState(false);
  const [history, setHistory]   = useState([]);
  const [hydrating, setHydrating] = useState(true);
  // Palm gate quality report (ordered list of checks)
  const [gateReport, setGateReport] = useState(null);
  // True between tapping "Take a Photo" and the native camera actually opening
  // (permission check + cold camera launch can lag a second or two) — drives a
  // spinner on the picker button so the tap doesn't feel dead.
  const [launching, setLaunching] = useState(false);

  // Warm up the detector.
  useEffect(() => { warmUpGate(); }, []);

  // Drawer screens stay mounted between focuses, so local state survives
  // navigation. Clear any stale gate-rejection error each time the screen
  // comes back into focus so the user sees a clean upload card.
  useFocusEffect(useCallback(() => { setError(""); }, []));

  // Sync palmPhoto from context → local preview. Drawer screens stay mounted,
  // so useState initial values only fire on first render. When PalmStepScreen
  // sets palmPhoto and navigates here, this effect picks it up.
  useEffect(() => {
    if (palmPhoto) setPreview({ uri: palmPhoto });
    else setPreview(null);
  }, [palmPhoto]);

  // Drives ONLY the source-picker drawer: set when the user taps a hand card,
  // cleared once a photo is picked / on reset. Deliberately NOT seeded from
  // palmClaimedHand — reviving it on mount or return would auto-reopen the
  // drawer over an existing reading (the bug this guards against). The
  // scan-screen badge reads palmClaimedHand (context) instead, so a scan
  // started on PalmStepScreen still shows its hand without touching the drawer.
  const [activeHand, setActiveHand] = useState(null);  // "Right" | "Left" | null

  // Animated scan-line on the preview.
  const scanAnim = useRef(new Animated.Value(0)).current;

  // Restore a saved reading once on mount. Skipped during rescan, and
  // while a background analysis is in flight (avoid flashing a stale prior
  // reading before the new one lands).
  useEffect(() => {
    if (palm || palmComparison || rescan || palmAnalyzing || !form?.name) {
      setHydrating(false);
      return;
    }
    fetchSaved("palm", form)
      .then((saved) => {
        if (saved) {
          if (saved.handType === "Both") {
            setPalmComparison(saved);
          } else {
            setPalm(saved);
          }
        }
      })
      .catch(() => {})
      .finally(() => setHydrating(false));
  }, [form, palm, palmComparison, rescan, palmAnalyzing, setPalm, setPalmComparison]);

  // Mirror the background-analyze flag into local scanning state + the
  // rotating message ticker so the existing scan UI works for analyses
  // started on another screen.
  useEffect(() => {
    if (!palmAnalyzing) {
      setScanning(false);
      return;
    }
    setScanning(true);
    setHydrating(false);
    let i = 0;
    setScanMsg(SCAN_MSGS[0]);
    const iv = setInterval(() => { i++; setScanMsg(SCAN_MSGS[i % SCAN_MSGS.length]); }, 1800);
    return () => clearInterval(iv);
  }, [palmAnalyzing]);

  // Load past readings list.
  useEffect(() => {
    if (!form?.name) return;
    fetchPalmHistory(form).then(setHistory).catch(() => {});
  }, [form, palm]);

  // Cooldown tick.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // Compare-flow overload → arm the shared cooldown for 50s.
  useEffect(() => {
    if (palmOverloaded && cooldown === 0) setCooldown(50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [palmOverloaded]);

  // Animate scan line while scanning.
  useEffect(() => {
    if (!scanning) {
      scanAnim.stopAnimation();
      scanAnim.setValue(0);
      return;
    }
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(scanAnim, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ])
    ).start();
  }, [scanning, scanAnim]);

  async function pick(source) {
    setError("");
    // Spinner on the picker button until the camera UI is up (then reset,
    // whether the user shot a photo or cancelled).
    setLaunching(true);
    let res;
    try {
      const perm =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError(source === "camera" ? "Camera permission denied." : "Photo permission denied.");
        return;
      }
      const opts = {
        mediaTypes: ["images"],
        base64: true,
        quality: 0.75,
        // Skip the system crop step — palm should be analyzed in full.
        allowsEditing: false,
        exif: true, // camera-origin signal for the gate's anti-screen-photo check
      };
      res = source === "camera"
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
    } finally {
      setLaunching(false);
    }
    if (res.canceled) return;
    const a = res.assets[0];

    // Once we have a photo, close the source-picker modal immediately.
    // If the gate or analysis fails, the error will show on the main
    // screen, but the modal won't pop back up.
    const hand = activeHand;
    setActiveHand(null);           // close the drawer
    setPalmClaimedHand(hand);      // keep the hand for the scan-screen badge

    // Client-side gate check (1–3s on cold model load). Flip `gating`
    // so the picker modal closes and a loading row shows in its place.
    setGating(true);
    setError(""); // Clear previous errors
    setGateReport(null); // Clear previous report
    try {
      // Wait for the gate MODEL to be ready (one-time load), THEN run the fast
      // inference — so the 21 landmarks the biometric match needs are reliably
      // captured rather than dropped by a timeout. Only a genuine model-load
      // failure falls back to the backend gate (skipGate:false below).
      let gateResult = null;
      let gateFailure = null; // human-readable reason the gate produced no landmarks
      try {
        await withTimeout(ensureGate(), MODEL_READY_TIMEOUT_MS);
        gateResult = await withTimeout(gatePalmImage(a, hand), GATE_INFER_TIMEOUT_MS);
      } catch (gateErr) {
        gateFailure = `Gate model unavailable: ${gateErr?.message || gateErr}`;
        console.warn("[palm] gate unavailable — deferring to backend gate:", gateErr?.message);
      }
      // The gate can also "pass" without landmarks when on-device inference
      // throws (palmGate carries that as gateResult.gateError). Either way, no
      // landmarks → no biometric embedding. Surface the reason so it's visible
      // instead of failing silently with a blank screen.
      if (gateResult?.gateError) gateFailure = gateResult.gateError;
      else if (gateResult?.ok && !gateResult?.landmarks) gateFailure = "Gate passed but produced no hand landmarks.";
      // TEMP DIAGNOSTIC — shows on every build (incl. preview/EAS where __DEV__
      // is false) so we can read the real on-device gate error. Remove once the
      // estimateHands failure is fixed.
      if (gateFailure) {
        Alert.alert("Palm gate diagnostic", gateFailure);
      }
      setGateReport(gateResult?.checks || null);
      if (gateResult && !gateResult.ok) {
        setError(gateResult.retakeReason);
        haptics.warning();
        return;
      }
      if (gateResult?.landmarks) {
        setPalmLandmarks({
          keypoints: gateResult.landmarks,
          imgW: gateResult.imgW,
          imgH: gateResult.imgH,
        });
      }   
      const img = await compressPhoto(a);
      // gateResult present → client gated (skipGate:true). Null → gate didn't
      // run; let the backend gate (skipGate:false). Pass the 21 landmarks (when
      // present) for the biometric match.
      runAnalyze(img, hand, !!gateResult, gateResult?.landmarks || null);
    } finally {
      setGating(false);
    }
  }

  async function runAnalyze(img, hand, skipGate = true, landmarks = null) {
    setError("");
    setLowCredits(false);
    setOverloaded(false);
    setPreview(img);
    setPalmPhoto(img.uri);
    setScanning(true);
    let i = 0;
    setScanMsg(SCAN_MSGS[0]);
    const iv = setInterval(() => { i++; setScanMsg(SCAN_MSGS[i % SCAN_MSGS.length]); }, 1800);
    try {
      const result = await analyzePalm(`data:image/jpeg;base64,${img.base64}`, form, hand, skipGate, landmarks);
      logEvent("palm_analysis_success", { hand, user_name: form.name });
      setPalm(result);
      setRescan(false);
      haptics.success();
    } catch (err) {
      if (err.code === "AI_OVERLOADED") {
        setOverloaded(true);
        setCooldown(50);
      } else if (err.code === "INSUFFICIENT_CREDITS") {
        setLowCredits(true);
        // Drop the un-analyzed photo so the upload card shows the hand-pick
        // buttons again instead of an empty scan frame.
        setPreview(null);
        setPalmPhoto(null);
      } else setError(err.message);
      haptics.warning();
    } finally {
      clearInterval(iv);
      setScanning(false);
    }
  }

  async function loadPast(id) {
    try {
      const past = await fetchPalmById(id, form);
      if (past) {
        if (past.handType === "Both") {
          setPalmComparison(past);
          setPalm(null);
        } else {
          setPalm(past);
          setPalmComparison(null);
        }
        setPreview(null);
        setRescan(false);
      }
    } catch {
      setError("Couldn't load that reading.");
    }
  }

  function reset() {
    setPalm(null);
    setPreview(null);
    setPalmPhoto(null);
    setPalmAnalyzing(false);
    setPalmLandmarks(null);
    setGateReport(null);
    setActiveHand(null);
    setPalmClaimedHand(null);
    setError("");
    setLowCredits(false);
    setPalmLowCredits(false);
    setRescan(true);
  }

  const unusable = palm?.imageQuality === "unusable";

  // Both-Hands comparison view replaces the single-hand UI entirely. Four
  // states: analyzing, Pro overloaded, either hand unusable, or ready.
  const inCompareMode =
    !!palmComparison
    || (palmAnalyzing && palmLeftPhoto && palmRightPhoto)
    || (palmOverloaded && palmLeftPhoto && palmRightPhoto)
    || (palmLowCredits && palmLeftPhoto && palmRightPhoto);

  return {
    // context state used by the view
    palm, palmComparison, palmAnalyzing, palmOverloaded, palmLowCredits,
    palmLeftPhoto, palmRightPhoto, palmClaimedHand, palmLandmarks,
    setPalmComparison, setPalmLeftPhoto, setPalmRightPhoto,
    setPalmAnalyzing, setPalmOverloaded,
    // local state
    preview, scanning, gating, scanMsg,
    error, setError, overloaded, setOverloaded,
    cooldown, history, hydrating, gateReport, launching,
    activeHand, setActiveHand, scanAnim,
    // derived
    palmCost, cannotAfford, unusable, inCompareMode,
    // handlers
    pick, runAnalyze, loadPast, reset,
  };
}
