import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Animated, Easing } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import AnimatedRE, { FadeIn, FadeInRight } from "react-native-reanimated";
import * as ImagePicker from "expo-image-picker";
import ScreenContainer from "../../components/ScreenContainer";
import MenuButton from "../../components/MenuButton";
import { SkeletonPalm } from "../../components/Skeleton";
import { useChart } from "../../context/ChartContext";
import { analyzePalm, fetchSaved, fetchPalmHistory, fetchPalmById } from "../../services/api";
import { gatePalmImage, warmUpGate } from "./palmGate";
import { useBackToKundali } from "../../utils/useBackToKundali";
import { haptics } from "../../utils/haptics";
import { logEvent } from "../../features/notifications/analytics";
import { compressPhoto } from "../../utils/compressImage";
import { useColors } from "../../theme/ThemeContext";
import { useStyles } from "../../theme/useStyles";
import { SCAN_MSGS } from "./constants";
import { makeStyles } from "./styles";
import CompareView from "./sections/CompareView";
import OverloadedCard from "./sections/OverloadedCard";
import PastReadings from "./sections/PastReadings";
import UploadView from "./sections/UploadView";
import ReadingResult from "./sections/ReadingResult";
import RejectView from "./sections/RejectView";
import SourcePickerModal from "./sections/SourcePickerModal";

export default function PalmScreen({ navigation }) {
  const {
    form, palm, setPalm,
    palmPhoto, setPalmPhoto,
    palmAnalyzing, setPalmAnalyzing,
    palmClaimedHand, setPalmClaimedHand,
    palmComparison, setPalmComparison,
    palmOverloaded, setPalmOverloaded,
    palmLeftPhoto, setPalmLeftPhoto,
    palmRightPhoto, setPalmRightPhoto,
  } = useChart();
  const color = useColors();
  const s = useStyles(makeStyles);
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

  // Warm up the detector.
  useEffect(() => { warmUpGate(); }, []);

  // Android hardware back → Reading/Kundali instead of exiting the app.
  useBackToKundali(navigation);

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

  // Hand the user just tapped on the upload screen. Drives the source-picker
  // modal AND the scan-screen badge. Seeded from context so a scan kicked
  // off on PalmStepScreen still shows the badge here.
  const [activeHand, setActiveHand] = useState(palmClaimedHand);  // "Right" | "Left" | null
  // Mirror local activeHand into context so the badge survives navigation.
  useEffect(() => { setPalmClaimedHand(activeHand); }, [activeHand, setPalmClaimedHand]);
  // Sync palmClaimedHand from context → local (photo picked on PalmStepScreen).
  useEffect(() => { if (palmClaimedHand) setActiveHand(palmClaimedHand); }, [palmClaimedHand]);

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
    };
    const res = source === "camera"
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled) return;
    const a = res.assets[0];

    // Once we have a photo, close the source-picker modal immediately.
    // If the gate or analysis fails, the error will show on the main
    // screen, but the modal won't pop back up.
    const hand = activeHand;
    setActiveHand(null);

    // Client-side gate check (1–3s on cold model load). Flip `gating`
    // so the picker modal closes and a loading row shows in its place.
    setGating(true);
    try {
      const gateResult = await gatePalmImage(a, hand);
      if (!gateResult.ok) {
        setError(gateResult.retakeReason);
        haptics.warning();
        return;
      }
      const img = await compressPhoto(a);
      runAnalyze(img, hand);
    } finally {
      setGating(false);
    }
  }

  async function runAnalyze(img, hand) {
    setError("");
    setOverloaded(false);
    setPreview(img);
    setPalmPhoto(img.uri);
    setScanning(true);
    let i = 0;
    setScanMsg(SCAN_MSGS[0]);
    const iv = setInterval(() => { i++; setScanMsg(SCAN_MSGS[i % SCAN_MSGS.length]); }, 1800);
    try {
      const result = await analyzePalm(`data:image/jpeg;base64,${img.base64}`, form, hand);
      logEvent("palm_analysis_success", { hand, user_name: form.name });
      setPalm(result);
      setRescan(false);
      haptics.success();
    } catch (err) {
      if (err.code === "AI_OVERLOADED") {
        setOverloaded(true);
        setCooldown(50);
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
    setActiveHand(null);
    setError("");
    setRescan(true);
  }

  const unusable = palm?.imageQuality === "unusable";

  // Both-Hands comparison view replaces the single-hand UI entirely. Four
  // states: analyzing, Pro overloaded, either hand unusable, or ready.
  const inCompareMode =
    !!palmComparison
    || (palmAnalyzing && palmLeftPhoto && palmRightPhoto)
    || (palmOverloaded && palmLeftPhoto && palmRightPhoto);

  if (inCompareMode) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg }}>
        <ScreenContainer showMenu={false}>
          <View style={s.headerRow}>
            <MenuButton />
            <View style={{ flex: 1 }}>
              <Text style={s.heroLabel} numberOfLines={1}>Full Life Comparison</Text>
              <Text style={s.heroSub} numberOfLines={1}>Photos discarded after analysis</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          <CompareView
            palmComparison={palmComparison}
            palmLeftPhoto={palmLeftPhoto}
            palmRightPhoto={palmRightPhoto}
            palmAnalyzing={palmAnalyzing}
            palmOverloaded={palmOverloaded}
            cooldown={cooldown}
            scanMsg={scanMsg}
            scanAnim={scanAnim}
            setPalmComparison={setPalmComparison}
            setPalmLeftPhoto={setPalmLeftPhoto}
            setPalmRightPhoto={setPalmRightPhoto}
            setPalmAnalyzing={setPalmAnalyzing}
            setPalmOverloaded={setPalmOverloaded}
            navigation={navigation}
            reset={reset}
          />
        </ScreenContainer>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScreenContainer showMenu={false}>
        <View style={s.headerRow}>
          <MenuButton />
          <View style={{ flex: 1 }}>
            <Text style={s.heroLabel} numberOfLines={1}>Palm Insights</Text>
            <Text style={s.heroSub} numberOfLines={1}>Photo discarded after analysis</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {hydrating ? (
          <SkeletonPalm />
        ) : (
          <>
            {overloaded && !palm && (
              <OverloadedCard
                cooldown={cooldown}
                preview={preview}
                runAnalyze={runAnalyze}
                setOverloaded={setOverloaded}
              />
            )}

            {/* Past readings */}
            {!palm && !scanning && history.length > 0 && (
              <AnimatedRE.View entering={FadeInRight.duration(400).springify()}>
                <PastReadings history={history} loadPast={loadPast} />
              </AnimatedRE.View>
            )}

            {/* Upload / scanning view */}
            {!palm && (
              <AnimatedRE.View entering={FadeIn.duration(400)}>
                <UploadView
                  navigation={navigation}
                  setActiveHand={setActiveHand}
                  setError={setError}
                  gating={gating}
                  error={error}
                  preview={preview}
                  scanning={scanning}
                  activeHand={activeHand}
                  scanAnim={scanAnim}
                  scanMsg={scanMsg}
                />
              </AnimatedRE.View>
            )}

            {/* Reading view */}
            {palm && !unusable && (
              <AnimatedRE.View entering={FadeIn.duration(400)}>
                <ReadingResult palm={palm} preview={preview} reset={reset} />
              </AnimatedRE.View>
            )}

            {/* Unusable */}
            {palm && unusable && (
              <AnimatedRE.View entering={FadeIn.duration(400)}>
                <RejectView palm={palm} preview={preview} reset={reset} />
              </AnimatedRE.View>
            )}
          </>
        )}
      </ScreenContainer>

      {/* Source-picker modal — appears after the user taps a hand card. */}
      <SourcePickerModal
        visible={activeHand !== null && !scanning && !gating && !palm && !palmAnalyzing}
        activeHand={activeHand}
        onClose={() => setActiveHand(null)}
        pick={pick}
      />
    </View>
  );
}
