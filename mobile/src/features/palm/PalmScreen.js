import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, Image, Pressable, StyleSheet,
  ActivityIndicator, Animated, Easing, Modal,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import ScreenContainer from "../../components/ScreenContainer";
import CosmicCard from "../../components/CosmicCard";
import MagicButton from "../../components/MagicButton";
import MenuButton from "../../components/MenuButton";
import { useChart } from "../../context/ChartContext";
import {
  analyzePalm, comparePalms, fetchSaved, fetchPalmHistory, fetchPalmById,
} from "../../services/api";
import { gatePalmImage, warmUpGate } from "./palmGate";
import { useBackToKundali } from "../../utils/useBackToKundali";
import { SkeletonPalm } from "../../components/Skeleton";
import { useColors } from "../../theme/ThemeContext";
import { useStyles } from "../../theme/useStyles";
import { radius, spacing, fontSize } from "../../theme/tokens";

// Friendly UI copy for each Gemini rejection category.
const REJECT_INFO = {
  not_a_palm:     { icon: "🤔", title: "That's not a palm",       tip: "Please upload a clear photo of your open hand, palm facing the camera." },
  back_of_hand:   { icon: "🔄", title: "Wrong side of the hand",  tip: "Flip your hand so the PALM (not the back) faces the camera." },
  blurry:         { icon: "📸", title: "Photo is too blurry",     tip: "Hold steady and take a sharp, focused photo of your palm." },
  too_dark:       { icon: "💡", title: "Lighting is too dark",    tip: "Move into bright, even light so the lines on your palm are clearly visible." },
  too_far:        { icon: "🔍", title: "Palm is too far away",    tip: "Bring the camera closer — your palm should fill most of the frame." },
  cropped:        { icon: "✂️", title: "Palm is cropped",         tip: "Include your full palm — from wrist to fingertips — in the photo." },
  multiple_hands: { icon: "✋", title: "More than one hand",      tip: "Show just one open palm in the photo." },
  wrong_hand:     { icon: "🔁", title: "Wrong hand uploaded",     tip: "The photo shows your other hand. Please retake using the hand you selected." },
  obstructed:     { icon: "🚫", title: "Palm is blocked",         tip: "Open your hand flat — remove rings, mehndi, or anything covering the main lines." },
  default:        { icon: "📸", title: "Photo unreadable",        tip: "Please retake with a clear, well-lit photo of your open palm." },
};

const SCAN_MSGS = [
  "Detecting your palm…",
  "Tracing the life line…",
  "Reading the head line…",
  "Examining the heart line…",
  "Following your fate line…",
  "Weaving the reading together…",
];

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
        return;
      }
      runAnalyze({ uri: a.uri, base64: a.base64 }, hand);
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
      setPalm(result);
      setRescan(false);
    } catch (err) {
      if (err.code === "AI_OVERLOADED") {
        setOverloaded(true);
        setCooldown(50);
      } else setError(err.message);
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
    const cmp     = palmComparison?.comparison;
    const leftBad  = palmComparison?.left?.imageQuality  === "unusable";
    const rightBad = palmComparison?.right?.imageQuality === "unusable";
    const eitherBad = leftBad || rightBad;

    function resetCompare() {
      setPalmComparison(null);
      setPalmLeftPhoto(null);
      setPalmRightPhoto(null);
      setPalmAnalyzing(false);
      setPalmOverloaded(false);
      navigation.navigate("PalmCompare");
    }

    // Retry the Both-Hands Pro call with the same photos. Disabled while
    // the shared cooldown is still counting down.
    function retryCompare() {
      setPalmOverloaded(false);
      setPalmAnalyzing(true);
      // palmLeftPhoto / palmRightPhoto are URIs from the picker; turn them
      // back into base64 data URLs the API expects. The originals came from
      // ImagePicker with base64 — we no longer have those bytes here so the
      // simpler approach is to ask the user to retake. For now we use the
      // saved URIs as data URLs (works when picker returned base64-encoded
      // data URIs, which expo-image-picker does NOT do by default). Fallback:
      // navigate back to PalmCompare so the user re-picks.
      navigation.navigate("PalmCompare");
    }

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

          {/* Both photos — with scan-line overlay when analyzing */}
          {(palmLeftPhoto || palmRightPhoto) ? (
            <CosmicCard>
              <View style={{ flexDirection: "row", gap: spacing.md }}>
                {[
                  ["POTENTIAL", palmLeftPhoto,  "Left"],
                  ["REALITY",   palmRightPhoto, "Right"],
                ].map(([label, uri, hand]) => (
                  <View key={hand} style={s.compareTile}>
                    <View style={s.compareImageWrap}>
                      {uri ? <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" /> : null}
                      {palmAnalyzing && !palmComparison && uri ? (
                        <Animated.View style={{
                          position: "absolute", left: 0, right: 0, height: 2,
                          backgroundColor: "#c084fc",
                          top: scanAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ["0%", "97%"],
                          }),
                        }} />
                      ) : null}
                    </View>
                    <Text style={s.compareHand}>{hand}</Text>
                    <Text style={s.compareSub}>{label}</Text>
                  </View>
                ))}
              </View>
            </CosmicCard>
          ) : null}

          {palmAnalyzing && !palmComparison && (
            <CosmicCard style={{ alignItems: "center" }}>
              <Text style={s.scanMsg}>{scanMsg}</Text>
              <Text style={s.scanSub}>Comparing both hands — usually 20–45 seconds.</Text>
              <ActivityIndicator color={color.primaryLight} style={{ marginTop: 8 }} />
            </CosmicCard>
          )}

          {palmOverloaded && !palmAnalyzing && !palmComparison && (
            <CosmicCard style={[s.aiBusyCard, { alignItems: "center" }]}>
              <Text style={{ fontSize: 36, lineHeight: 48 }}>⏳</Text>
              <Text style={[s.errTitle, { color: color.warning }]}>AI is busy right now</Text>
              <Text style={s.errBody}>
                Our reader couldn't compare your palms after several tries.
                {cooldown > 0 ? " Please wait a moment before trying again." : " You can try again now."}
              </Text>
              <MagicButton style={{ width: "100%" }} disabled={cooldown > 0} onPress={retryCompare}>
                {cooldown > 0 ? `🕒 Try Again in ${cooldown}s` : "🔄 Try Again"}
              </MagicButton>
            </CosmicCard>
          )}

          {palmComparison && eitherBad && (() => {
            // Surface the per-hand reject reason (wrong_hand vs blurry vs
            // too_dark etc.) instead of a generic lighting prompt — so the
            // user knows which hand failed and why.
            const badHands = [
              leftBad  ? { side: "Left",  info: REJECT_INFO[palmComparison.left.rejectReason]  || REJECT_INFO.default, server: palmComparison.left.retakeReason  } : null,
              rightBad ? { side: "Right", info: REJECT_INFO[palmComparison.right.rejectReason] || REJECT_INFO.default, server: palmComparison.right.retakeReason } : null,
            ].filter(Boolean);
            return (
              <CosmicCard style={{ borderColor: "rgba(248,113,113,0.4)", backgroundColor: "rgba(248,113,113,0.06)" }}>
                <Text style={[s.rejectTitle, { textAlign: "center", marginBottom: spacing.md }]}>
                  {badHands.length === 2 ? "Both photos need a retake" : `${badHands[0].side} photo needs a retake`}
                </Text>
                {badHands.map(({ side, info, server }) => (
                  <View key={side} style={s.rejectRow}>
                    <Text style={s.rejectRowIcon}>{info.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.rejectRowSide}>{side} Hand</Text>
                      <Text style={s.rejectRowTitle}>{info.title}</Text>
                      <Text style={s.rejectRowTip}>{server || info.tip}</Text>
                    </View>
                  </View>
                ))}
                <MagicButton style={{ width: "100%", marginTop: spacing.md }} onPress={resetCompare}>
                  📷 Retake Both Photos
                </MagicButton>
              </CosmicCard>
            );
          })()}

          {cmp && !eitherBad && (
            <>
              <View style={s.summary}>
                <Text style={s.summaryLabel}>Alignment · {cmp.alignment || "—"}</Text>
                <Text style={s.summaryVibe}>"{cmp.evolution}"</Text>
              </View>

              {[
                ["Life Line",  "🌿", cmp.lifeLine],
                ["Head Line",  "🧠", cmp.headLine],
                ["Heart Line", "💛", cmp.heartLine],
                ["Fate Line",  "🪐", cmp.fateLine],
              ].map(([title, icon, content]) =>
                content ? (
                  <CosmicCard key={title}>
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                      <Text style={{ fontSize: 22, lineHeight: 30, marginRight: 10 }}>{icon}</Text>
                      <Text style={s.lineTitle}>{title}</Text>
                    </View>
                    <Text style={s.lineBody}>{content}</Text>
                  </CosmicCard>
                ) : null
              )}

              {(cmp.grownStronger?.length > 0 || cmp.watchPoints?.length > 0) && (
                <View style={{ flexDirection: "row", gap: spacing.md, marginBottom: spacing.lg }}>
                  {cmp.grownStronger?.length > 0 && (
                    <CosmicCard style={[s.halfCard, { borderColor: "rgba(34,197,94,0.2)", flex: 1, marginBottom: 0 }]}>
                      <Text style={[s.halfTitle, { color: color.success }]}>✦ Grown Stronger</Text>
                      {cmp.grownStronger.map((g, i) => (
                        <View key={i} style={s.bulletRow}>
                          <Text style={{ color: color.success, fontWeight: "700", marginRight: 6 }}>↑</Text>
                          <Text style={s.bulletText}>{g}</Text>
                        </View>
                      ))}
                    </CosmicCard>
                  )}
                  {cmp.watchPoints?.length > 0 && (
                    <CosmicCard style={[s.halfCard, { borderColor: "rgba(251,191,36,0.2)", flex: 1, marginBottom: 0 }]}>
                      <Text style={[s.halfTitle, { color: color.warning }]}>✦ Still Showing Up</Text>
                      {cmp.watchPoints.map((w, i) => (
                        <View key={i} style={s.bulletRow}>
                          <Text style={{ color: color.warning, fontWeight: "700", marginRight: 6 }}>•</Text>
                          <Text style={s.bulletText}>{w}</Text>
                        </View>
                      ))}
                    </CosmicCard>
                  )}
                </View>
              )}

              {cmp.lifeAdvice ? (
                <CosmicCard style={{ borderColor: "rgba(168,85,247,0.25)" }}>
                  <Text style={[s.cardTitle, { color: color.primaryLight }]}>🎯 Direction</Text>
                  <Text style={s.lineBody}>{cmp.lifeAdvice}</Text>
                </CosmicCard>
              ) : null}

              <View style={{ flexDirection: "row", gap: spacing.md }}>
                <Pressable onPress={resetCompare} style={[s.revealBtn, { flex: 1, marginBottom: 0 }]}>
                  <Text style={s.revealText}>🔄 Re-do Comparison</Text>
                </Pressable>
                <Pressable onPress={() => {
                   setPalmComparison(null);
                   setPalmLeftPhoto(null);
                   setPalmRightPhoto(null);
                   setPalmAnalyzing(false);
                   setPalmOverloaded(false);
                   reset();
                   // stays on the same screen but renders the upload UI
                 }} style={[s.revealBtn, { flex: 1, marginBottom: 0, backgroundColor: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)" }]}>
                   <Text style={[s.revealText, { color: "#94a3b8" }]}>🖐️ Scan Different Hand</Text>
                 </Pressable>
              </View>

              <Text style={s.disclaimer}>
                Palmistry is a tool for self-reflection. Insights here are interpretive, not predictive.
              </Text>
            </>
          )}
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
          <CosmicCard style={[s.aiBusyCard, { alignItems: "center" }]}>
            <Text style={{ fontSize: 36, lineHeight: 48 }}>⏳</Text>
            <Text style={[s.errTitle, { color: color.warning }]}>AI is busy right now</Text>
            <Text style={s.errBody}>
              Our reader couldn't analyze your palm after several tries.
              {cooldown > 0 ? " Please wait a moment before trying again." : " You can try again now."}
            </Text>
            {preview ? (
              <MagicButton style={{ width: "100%" }} disabled={cooldown > 0} onPress={() => runAnalyze(preview)}>
                {cooldown > 0 ? `🕒 Try Again in ${cooldown}s` : "🔄 Try Again with Same Photo"}
              </MagicButton>
            ) : (
              <MagicButton style={{ width: "100%" }} disabled={cooldown > 0} onPress={() => setOverloaded(false)}>
                {cooldown > 0 ? `🕒 Wait ${cooldown}s` : "Upload a New Photo"}
              </MagicButton>
            )}
          </CosmicCard>
        )}

        {/* Past readings */}
        {!palm && !scanning && history.length > 0 && (
          <CosmicCard>
            <Text style={s.cardTitle}>📂 Your Past Readings</Text>
            <Text style={s.cardSub}>Tap to view — no AI re-run.</Text>
            {history.map((h) => {
              const d = new Date(h.createdAt);
              const when =
                d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
                ", " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
              const bad = h.imageQuality === "unusable";
              return (
                <Pressable
                  key={h.id}
                  onPress={() => !bad && loadPast(h.id)}
                  disabled={bad}
                  style={[s.historyRow, bad && { opacity: 0.5 }]}
                >
                  <Text style={s.historyTitle}>
                    ✋ {h.handType || "Unclear"} Hand
                    {bad ? <Text style={{ color: color.danger, fontSize: 10 }}>  · unreadable</Text> : null}
                  </Text>
                  <Text style={s.historyDate}>{when}</Text>
                </Pressable>
              );
            })}
          </CosmicCard>
        )}

        {/* Upload / scanning view */}
        {!palm && (
          <CosmicCard style={{ alignItems: "center", padding: spacing.xl }}>
            {!preview && !scanning && (
              <>
                <Text style={{ fontSize: 64, lineHeight: 84, marginBottom: 12, textAlign: "center" }}>✋</Text>
                <Text style={s.uploadTitle}>Scan Your Palm</Text>
                <Text style={s.uploadHint}>
                  Pick which hand you're uploading. We'll check the photo matches the hand you choose.
                </Text>

                {/* Premium headline card — Both Hands · Full Life Comparison */}
                <Pressable
                  onPress={() => navigation.navigate("PalmCompare")}
                  style={({ pressed }) => [s.uploadBothBtn, pressed && { opacity: 0.85 }, { marginTop: spacing.md }]}
                >
                  {/* Split glyphs to avoid Android clipping of joined "✋🤚". */}
                  <View style={s.uploadBothIconWrap}>
                    <Text style={s.uploadBothIconGlyph}>✋</Text>
                    <Text style={s.uploadBothIconGlyph}>🤚</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.uploadHandLabel}>Both Hands · Full Life Comparison</Text>
                    <Text style={[s.uploadHandSub, { color: color.primaryLight }]}>
                      Compare your inborn potential against your current reality
                    </Text>
                  </View>
                  <Text style={[s.chev, { color: color.primaryLight }]}>›</Text>
                </Pressable>

                <Pressable
                  onPress={() => { setError(""); setActiveHand("Right"); }}
                  style={({ pressed }) => [s.uploadHandBtn, pressed && { opacity: 0.7 }, { marginTop: spacing.sm }]}
                >
                  <Text style={s.uploadHandIcon}>✋</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.uploadHandLabel}>Right Hand</Text>
                    <Text style={s.uploadHandSub}>Tap to take or pick a photo</Text>
                  </View>
                  <Text style={[s.chev, { color: color.primaryLight }]}>›</Text>
                </Pressable>
                <Pressable
                  onPress={() => { setError(""); setActiveHand("Left"); }}
                  style={({ pressed }) => [s.uploadHandBtn, pressed && { opacity: 0.7 }, { marginTop: spacing.sm }]}
                >
                  <Text style={s.uploadHandIcon}>🤚</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.uploadHandLabel}>Left Hand</Text>
                    <Text style={s.uploadHandSub}>Tap to take or pick a photo</Text>
                  </View>
                  <Text style={[s.chev, { color: color.primaryLight }]}>›</Text>
                </Pressable>

                {gating && (
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.md }}>
                    <ActivityIndicator size="small" color={color.primaryLight} />
                    <Text style={{ color: color.textDim, fontSize: fontSize.sm }}>Reading photo…</Text>
                  </View>
                )}

                {error ? (
                  <Text style={[s.error, { marginTop: spacing.md, textAlign: "center" }]}>{error}</Text>
                ) : null}
              </>
            )}

            {preview && scanning && (
              <View style={{ alignItems: "center", width: "100%" }}>
                {activeHand ? (
                  <View style={s.handBadge}>
                    <Text style={s.handBadgeIcon}>{activeHand === "Right" ? "✋" : "🤚"}</Text>
                    <Text style={s.handBadgeText}>{activeHand} Hand</Text>
                  </View>
                ) : null}
                <View style={s.scanFrame}>
                  <Image source={{ uri: preview.uri }} style={s.scanImage} resizeMode="cover" />
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      s.scanLine,
                      {
                        top: scanAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["0%", "97%"],
                        }),
                      },
                    ]}
                  />
                </View>
                <Text style={s.scanMsg}>{scanMsg}</Text>
                <Text style={s.scanSub}>This usually takes 10–30 seconds.</Text>
                <ActivityIndicator color={color.primaryLight} style={{ marginTop: 8 }} />
              </View>
            )}
          </CosmicCard>
        )}

        {/* Reading view */}
        {palm && !unusable && (
          <>
            {preview && (
              <CosmicCard style={{ padding: 14, alignItems: "center" }}>
                {palm.handType && palm.handType !== "Unclear" ? (
                  <View style={s.handBadge}>
                    <Text style={s.handBadgeIcon}>{palm.handType === "Right" ? "✋" : "🤚"}</Text>
                    <Text style={s.handBadgeText}>{palm.handType} Hand</Text>
                  </View>
                ) : null}
                <View style={s.palmPhoto}>
                  <Image source={{ uri: preview.uri }} style={{ width: "100%", aspectRatio: 3 / 4 }} resizeMode="cover" />
                </View>
              </CosmicCard>
            )}

            <View style={s.summary}>
              <Text style={s.summaryLabel}>
                {palm.handType} Hand · {palm.imageQuality}
              </Text>
              <Text style={s.summaryVibe}>"{palm.overallVibe}"</Text>
            </View>

            {[
              ["Life Line",      "🌿", palm.lifeLine],
              ["Head Line",      "🧠", palm.headLine],
              ["Heart Line",     "💛", palm.heartLine],
              ["Fate Line",      "🪐", palm.fateLine],
              ["Mount of Venus", "✨", palm.mountOfVenus],
              ["Marriage Lines", "💍", palm.marriageLines],
            ].map(([title, icon, content]) =>
              content ? (
                <CosmicCard key={title}>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                    <Text style={{ fontSize: 22, lineHeight: 30, marginRight: 10 }}>{icon}</Text>
                    <Text style={s.lineTitle}>{title}</Text>
                  </View>
                  <Text style={s.lineBody}>{content}</Text>
                </CosmicCard>
              ) : null
            )}

            {(palm.strengths?.length > 0 || palm.watchOuts?.length > 0) && (
              <View style={{ flexDirection: "row", gap: spacing.md, marginBottom: spacing.lg }}>
                {palm.strengths?.length > 0 && (
                  <CosmicCard style={[s.halfCard, { borderColor: "rgba(34,197,94,0.2)", flex: 1, marginBottom: 0 }]}>
                    <Text style={[s.halfTitle, { color: color.success }]}>✦ Strengths</Text>
                    {palm.strengths.map((sp, i) => (
                      <View key={i} style={s.bulletRow}>
                        <Text style={{ color: color.success, fontWeight: "700", marginRight: 6 }}>✓</Text>
                        <Text style={s.bulletText}>{sp}</Text>
                      </View>
                    ))}
                  </CosmicCard>
                )}
                {palm.watchOuts?.length > 0 && (
                  <CosmicCard style={[s.halfCard, { borderColor: "rgba(251,191,36,0.2)", flex: 1, marginBottom: 0 }]}>
                    <Text style={[s.halfTitle, { color: color.warning }]}>✦ Watch For</Text>
                    {palm.watchOuts.map((c, i) => (
                      <View key={i} style={s.bulletRow}>
                        <Text style={{ color: color.warning, fontWeight: "700", marginRight: 6 }}>↑</Text>
                        <Text style={s.bulletText}>{c}</Text>
                      </View>
                    ))}
                  </CosmicCard>
                )}
              </View>
            )}

            {palm.practicalGuidance && (palm.practicalGuidance.career || palm.practicalGuidance.love) && (
              <CosmicCard style={{ borderColor: "rgba(168,85,247,0.25)" }}>
                <Text style={[s.cardTitle, { color: color.primaryLight }]}>🎯 Practical Guidance</Text>
                <Text style={s.cardSub}>Concrete next steps from your Fate and Heart lines.</Text>
                {palm.practicalGuidance.career && (
                  <View style={[s.guideBlock, { borderLeftColor: color.warning, backgroundColor: "rgba(251,191,36,0.08)" }]}>
                    <Text style={[s.guideHead, { color: color.warning }]}>CAREER</Text>
                    <Text style={s.guideBody}>{palm.practicalGuidance.career}</Text>
                  </View>
                )}
                {palm.practicalGuidance.love && (
                  <View style={[s.guideBlock, { borderLeftColor: color.danger, backgroundColor: "rgba(248,113,113,0.08)" }]}>
                    <Text style={[s.guideHead, { color: color.danger }]}>LOVE</Text>
                    <Text style={s.guideBody}>{palm.practicalGuidance.love}</Text>
                  </View>
                )}
              </CosmicCard>
            )}

            {palm.palmistryNotes?.length > 0 && (
              <CosmicCard style={{ borderColor: "rgba(99,102,241,0.25)" }}>
                <Text style={[s.cardTitle, { color: color.accentLight }]}>📜 Classical Palmistry Notes</Text>
                <Text style={s.cardSub}>Traditional rules cross-checked against your reading.</Text>
                {palm.palmistryNotes.map((n, i) => (
                  <View key={i} style={s.noteRow}>
                    <Text style={{ color: color.accentLight, fontWeight: "700", marginRight: 6 }}>✓</Text>
                    <Text style={s.noteText}>{n}</Text>
                  </View>
                ))}
              </CosmicCard>
            )}

            <Pressable onPress={reset} style={s.revealBtn}>
              <Text style={s.revealText}>🔄 Scan a Different Palm</Text>
            </Pressable>

            <Text style={s.disclaimer}>
              Palmistry is a tool for self-reflection. Insights here are interpretive, not predictive.
            </Text>
          </>
        )}

        {/* Unusable */}
        {palm && unusable && (() => {
          const info = REJECT_INFO[palm.rejectReason] || REJECT_INFO.default;
          return (
            <CosmicCard style={{ borderColor: "rgba(248,113,113,0.4)", backgroundColor: "rgba(248,113,113,0.06)", alignItems: "center" }}>
              {preview?.uri ? (
                <View style={s.rejectThumb}>
                  <Image source={{ uri: preview.uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                </View>
              ) : null}
              <Text style={{ fontSize: 44, lineHeight: 58 }}>{info.icon}</Text>
              <Text style={s.rejectTitle}>{info.title}</Text>
              <Text style={s.rejectTip}>{info.tip}</Text>
              {palm.retakeReason ? (
                <Text style={s.rejectReason}>{palm.retakeReason}</Text>
              ) : null}
              <MagicButton style={{ width: "100%", marginTop: spacing.md }} onPress={reset}>
                📷 Upload Another Photo
              </MagicButton>
            </CosmicCard>
          );
        })()}
        </>
        )}
      </ScreenContainer>

      {/* Source-picker modal — appears after the user taps a hand card. */}
      <Modal
        visible={activeHand !== null && !scanning && !gating && !palm && !palmAnalyzing}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveHand(null)}
      >
        <Pressable onPress={() => setActiveHand(null)} style={s.modalBackdrop}>
          <Pressable onPress={(e) => e.stopPropagation()} style={s.modalSheet}>
            <Text style={s.modalTitle}>
              {activeHand} Hand · How would you like to add the photo?
            </Text>
            <Pressable
              onPress={() => pick("camera")}
              style={({ pressed }) => [s.sourceBtn, s.sourceBtnPrimary, pressed && { opacity: 0.85 }]}
            >
              <Text style={s.sourceIcon}>📷</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.sourceLabel}>Take a Photo</Text>
                <Text style={s.sourceSub}>Use your camera</Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => pick("library")}
              style={({ pressed }) => [s.sourceBtn, pressed && { opacity: 0.85 }]}
            >
              <Text style={s.sourceIcon}>🖼️</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.sourceLabel}>Upload from Device</Text>
                <Text style={s.sourceSub}>Pick a photo from your gallery</Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => setActiveHand(null)}
              style={({ pressed }) => [s.modalCancel, pressed && { opacity: 0.7 }]}
            >
              <Text style={s.modalCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  backBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: c.accentBorder, backgroundColor: c.accentSoft,
    marginBottom: spacing.lg,
  },
  backText: { color: c.accentLight, fontSize: 12, fontWeight: "600" },

  heroLabel: { color: c.primaryLight, fontSize: 13, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", textAlign: "center" },
  heroSub:   { color: c.textMuted, fontSize: 11, marginTop: 4, textAlign: "center" },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },

  cardTitle: { color: c.text, fontSize: fontSize.md, lineHeight: 22, fontWeight: "700", marginBottom: 4 },
  cardSub:   { color: c.textMuted, fontSize: 11, marginBottom: spacing.md },

  aiBusyCard: {
    backgroundColor: c.cardBgSolid,
    borderWidth: 1.5,
    borderColor: c.warning,
  },
  errTitle: { color: c.danger, fontSize: 14, fontWeight: "600", marginTop: 6 },
  errBody:  { color: c.textDim, fontSize: 12.5, textAlign: "center", lineHeight: 18, marginVertical: 8 },
  // Inline rejection text on the upload card — mirrors PalmStepScreen.error
  // (was previously undefined, causing the dark/black empty-text look).
  error:    { color: c.danger, fontSize: 13, textAlign: "center" },

  historyRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: "rgba(168,85,247,0.25)", backgroundColor: "rgba(168,85,247,0.06)",
    marginBottom: 8,
  },
  historyTitle: { color: c.textBody, fontSize: 13, fontWeight: "600", flex: 1 },
  historyDate:  { color: c.textMuted, fontSize: 11 },

  uploadTitle: { color: c.text, fontSize: 16, fontWeight: "600", marginBottom: 6 },
  uploadHint:  { color: c.textDim, fontSize: 12, textAlign: "center", lineHeight: 18 },

  uploadHandBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingVertical: 14, paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: c.primaryBorder,
    backgroundColor: c.primarySoft,
    width: "100%",
  },
  // Premium-flavored variant for the Both-Hands entry — brighter border so
  // it reads as the headline card. Mirrors PalmStepScreen.bothBtn.
  uploadBothBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingVertical: 16, paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: c.primaryLight,
    backgroundColor: c.primarySoft,
    width: "100%",
  },
  uploadHandIcon: {
    fontSize: 26, lineHeight: 36, width: 36,
    textAlign: "center", textAlignVertical: "center", includeFontPadding: false,
  },
  // Wider variant for the Both-Hands button — single-emoji width (36) was
  // clipping the second emoji of "✋🤚".
  uploadBothIcon: {
    fontSize: 24, lineHeight: 36, width: 60,
    textAlign: "center", textAlignVertical: "center", includeFontPadding: false,
  },
  // Split-glyph variant — each emoji in its own Text view side-by-side,
  // works around Android's joined-run clipping.
  uploadBothIconWrap: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    width: 60, height: 36,
  },
  uploadBothIconGlyph: {
    fontSize: 22, lineHeight: 32, marginHorizontal: 1,
    includeFontPadding: false,
  },
  uploadHandLabel: { color: c.text, fontSize: 14, fontWeight: "700" },
  uploadHandSub:   { color: c.textMuted, fontSize: 12, marginTop: 2 },
  chev:            { fontSize: 22, fontWeight: "700", paddingHorizontal: 6 },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: c.bg,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderWidth: 1, borderColor: c.primaryBorder,
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  modalTitle: { color: c.text, fontSize: 14, fontWeight: "600", textAlign: "center", marginBottom: 4 },
  sourceBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingVertical: 14, paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: c.cardBorder,
    backgroundColor: c.cardBg,
  },
  sourceBtnPrimary: { borderColor: c.primaryBorder, backgroundColor: c.primarySoft },
  sourceIcon: { fontSize: 26, lineHeight: 36, width: 40, textAlign: "center", textAlignVertical: "center", includeFontPadding: false },
  sourceLabel:{ color: c.text, fontSize: 15, fontWeight: "700" },
  sourceSub:  { color: c.textMuted, fontSize: 12, marginTop: 2 },
  modalCancel:{ paddingVertical: 12, paddingHorizontal: spacing.md, borderRadius: radius.lg, alignItems: "center", marginTop: 4 },
  modalCancelText: { color: c.textDim, fontSize: 14, fontWeight: "600" },

  handBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1, borderColor: "rgba(168,85,247,0.5)",
    backgroundColor: "rgba(168,85,247,0.12)",
    marginBottom: 12,
  },
  handBadgeIcon: { fontSize: 14, lineHeight: 18 },
  handBadgeText: { color: c.primaryLight, fontSize: 12, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase" },

  scanFrame: {
    width: "100%", maxWidth: 320, aspectRatio: 3 / 4,
    borderRadius: 16, overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(168,85,247,0.4)",
    marginBottom: 16,
    position: "relative",
  },
  scanImage: { width: "100%", height: "100%" },
  scanLine: {
    position: "absolute", left: 0, right: 0, height: 3,
    backgroundColor: "#c084fc",
    shadowColor: "#c084fc",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 8,
    elevation: 8,
  },
  scanMsg: { fontSize: 14, fontWeight: "600", color: c.primaryLight, marginTop: 4 },
  scanSub: { fontSize: 11, color: c.textMuted, marginTop: 4 },

  palmPhoto: {
    width: "100%", maxWidth: 320, alignSelf: "center",
    borderRadius: 14, overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(168,85,247,0.3)",
  },

  summary: {
    backgroundColor: "rgba(99,102,241,0.15)",
    borderWidth: 1, borderColor: "rgba(168,85,247,0.3)",
    borderRadius: radius.xl, padding: spacing.xl,
    marginBottom: spacing.lg,
    alignItems: "center",
  },
  summaryLabel: {
    color: c.primary, fontSize: 12, fontWeight: "700",
    letterSpacing: 3, textTransform: "uppercase", marginBottom: 8,
  },
  summaryVibe: {
    color: c.text, fontSize: 17, fontStyle: "italic", textAlign: "center", lineHeight: 26,
  },

  lineTitle: { color: c.text, fontSize: 15, lineHeight: 22, fontWeight: "700", letterSpacing: 0.5 },
  lineBody:  { color: c.textDim, fontSize: 13, lineHeight: 22 },

  halfCard:  { padding: spacing.md },
  halfTitle: { fontSize: 14, lineHeight: 20, fontWeight: "700", marginBottom: 12 },
  bulletRow: { flexDirection: "row", marginBottom: 8 },
  bulletText:{ flex: 1, color: c.textDim, fontSize: 13.5, lineHeight: 19 },

  guideBlock: {
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10,
    borderLeftWidth: 3, marginBottom: 12,
  },
  guideHead: { fontSize: 10, letterSpacing: 1.5, fontWeight: "700", marginBottom: 4 },
  guideBody: { color: c.textBody, fontSize: 13, lineHeight: 21 },

  noteRow: {
    flexDirection: "row", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    backgroundColor: c.inputBg,
    borderLeftWidth: 3, borderLeftColor: c.accent,
    marginBottom: 8,
  },
  noteText: { flex: 1, color: c.textDim, fontSize: 13, lineHeight: 19 },

  revealBtn: {
    paddingVertical: 12, borderRadius: 10, marginTop: spacing.sm, alignItems: "center",
    borderWidth: 1, borderColor: c.primaryBorder, backgroundColor: c.primarySoft,
  },
  revealText: { color: c.primaryLight, fontSize: 13, fontWeight: "600" },

  disclaimer: {
    fontSize: 11, color: c.textFaint, textAlign: "center",
    marginTop: spacing.xl, lineHeight: 18,
  },

  // ── Both-Hands comparison view ──
  compareTile: { flex: 1, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "rgba(168,85,247,0.3)", backgroundColor: "rgba(15,14,32,0.6)" },
  compareImageWrap: { width: "100%", aspectRatio: 3 / 4, backgroundColor: "#0f0e20" },
  compareHand: { textAlign: "center", color: c.primaryLight, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: "700", marginTop: 8 },
  compareSub:  { textAlign: "center", color: c.textMuted, fontSize: 12, marginTop: 2, marginBottom: 8 },

  compareLink: {
    marginTop: 12, paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 10, borderWidth: 1, borderColor: "rgba(192,132,252,0.4)",
    backgroundColor: "rgba(168,85,247,0.10)", alignItems: "center",
  },
  compareLinkText: { color: c.primaryLight, fontSize: 12.5, fontWeight: "600" },

  rejectThumb: {
    width: 140, height: 140,
    borderRadius: 12, overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(248,113,113,0.45)",
    marginBottom: 12,
  },
  rejectRow: {
    flexDirection: "row", gap: 12, alignItems: "flex-start",
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: "rgba(248,113,113,0.35)",
    backgroundColor: "rgba(15,14,32,0.55)",
    marginBottom: 10,
  },
  rejectRowIcon:  { fontSize: 26, lineHeight: 34 },
  rejectRowSide:  { color: c.warning, fontSize: 11, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase" },
  rejectRowTitle: { color: c.danger, fontSize: 14, fontWeight: "700", marginTop: 4 },
  rejectRowTip:   { color: c.textDim, fontSize: 12.5, marginTop: 4, lineHeight: 18 },

  rejectTitle:  { fontSize: 16, fontWeight: "700", color: c.danger, marginTop: 12 },
  rejectTip:    { fontSize: 13.5, color: c.textDim, textAlign: "center", lineHeight: 22, marginVertical: 6 },
  rejectReason: { fontSize: 12, color: c.textMuted, textAlign: "center", lineHeight: 19, fontStyle: "italic", marginTop: 6 },
});
