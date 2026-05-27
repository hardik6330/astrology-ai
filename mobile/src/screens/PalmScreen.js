import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, Image, Pressable, StyleSheet,
  ActivityIndicator, Animated, Easing,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import ScreenContainer from "../components/ScreenContainer";
import CosmicCard from "../components/CosmicCard";
import MagicButton from "../components/MagicButton";
import MenuButton from "../components/MenuButton";
import { useChart } from "../context/ChartContext";
import {
  analyzePalm, fetchSaved, fetchPalmHistory, fetchPalmById,
} from "../services/api";
import { SkeletonPalm } from "../components/Skeleton";
import { useColors } from "../theme/ThemeContext";
import { useStyles } from "../theme/useStyles";
import { radius, spacing, fontSize } from "../theme/tokens";

// Friendly UI copy for each Gemini rejection category.
const REJECT_INFO = {
  not_a_palm:     { icon: "🤔", title: "That's not a palm",       tip: "Please upload a clear photo of your open hand, palm facing the camera." },
  back_of_hand:   { icon: "🔄", title: "Wrong side of the hand",  tip: "Flip your hand so the PALM (not the back) faces the camera." },
  blurry:         { icon: "📸", title: "Photo is too blurry",     tip: "Hold steady and take a sharp, focused photo of your palm." },
  too_dark:       { icon: "💡", title: "Lighting is too dark",    tip: "Move into bright, even light so the lines on your palm are clearly visible." },
  too_far:        { icon: "🔍", title: "Palm is too far away",    tip: "Bring the camera closer — your palm should fill most of the frame." },
  cropped:        { icon: "✂️", title: "Palm is cropped",         tip: "Include your full palm — from wrist to fingertips — in the photo." },
  multiple_hands: { icon: "✋", title: "More than one hand",      tip: "Show just one open palm in the photo." },
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
  const { form, palm, setPalm, palmPhoto, setPalmPhoto, palmAnalyzing, setPalmAnalyzing } = useChart();
  const color = useColors();
  const s = useStyles(makeStyles);
  // Mirror context.palmPhoto so a photo uploaded on PalmStepScreen still
  // shows up here (the screen unmounts in between).
  const [preview, setPreview]   = useState(palmPhoto ? { uri: palmPhoto } : null);
  // Mirror palmAnalyzing so a background analysis started elsewhere drives
  // the scan animation here when the user opens this screen.
  const [scanning, setScanning] = useState(palmAnalyzing);
  const [scanMsg, setScanMsg]   = useState(SCAN_MSGS[0]);
  const [error, setError]       = useState("");
  const [overloaded, setOverloaded] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [rescan, setRescan]     = useState(false);
  const [history, setHistory]   = useState([]);
  const [hydrating, setHydrating] = useState(true);

  // Animated scan-line on the preview.
  const scanAnim = useRef(new Animated.Value(0)).current;

  // Restore a saved reading once on mount. Skipped during rescan, and
  // while a background analysis is in flight (avoid flashing a stale prior
  // reading before the new one lands).
  useEffect(() => {
    if (palm || rescan || palmAnalyzing || !form?.name) { setHydrating(false); return; }
    fetchSaved("palm", form)
      .then((saved) => { if (saved) setPalm(saved); })
      .catch(() => {})
      .finally(() => setHydrating(false));
  }, [form, palm, rescan, palmAnalyzing, setPalm]);

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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
    runAnalyze({ uri: a.uri, base64: a.base64 });
  }

  async function runAnalyze(img) {
    setError("");
    setOverloaded(false);
    setPreview(img);
    setPalmPhoto(img.uri);
    setScanning(true);
    let i = 0;
    setScanMsg(SCAN_MSGS[0]);
    const iv = setInterval(() => { i++; setScanMsg(SCAN_MSGS[i % SCAN_MSGS.length]); }, 1800);
    try {
      const result = await analyzePalm(`data:image/jpeg;base64,${img.base64}`, form);
      setPalm(result);
      setRescan(false);
    } catch (err) {
      if (err.code === "AI_OVERLOADED") {
        setOverloaded(true);
        setCooldown(40);
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
        setPalm(past);
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
    setError("");
    setRescan(true);
  }

  const unusable = palm?.imageQuality === "unusable";

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

        {error ? (
          <CosmicCard error style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 28, lineHeight: 38 }}>⚠️</Text>
            <Text style={s.errTitle}>Something went wrong</Text>
            <Text style={s.errBody}>{error}</Text>
            <Pressable onPress={() => setError("")} style={s.dismissBtn}>
              <Text style={s.dismissText}>Dismiss</Text>
            </Pressable>
          </CosmicCard>
        ) : null}

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
                  Take a clear photo of your dominant hand. Open your palm flat, good lighting, fingers slightly spread.
                </Text>
                <MagicButton style={{ width: "100%", marginTop: spacing.md }} onPress={() => pick("camera")}>
                  📷 Take Photo
                </MagicButton>
                <MagicButton variant="ghost" style={{ width: "100%", marginTop: spacing.sm }} onPress={() => pick("library")}>
                  🖼️ Upload from Gallery
                </MagicButton>
              </>
            )}

            {preview && scanning && (
              <View style={{ alignItems: "center", width: "100%" }}>
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
              <CosmicCard style={{ padding: 14 }}>
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
  dismissBtn: {
    paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: "rgba(239,68,68,0.4)", backgroundColor: "rgba(239,68,68,0.08)",
  },
  dismissText: { color: "#fca5a5", fontSize: 12, fontWeight: "600" },

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

  rejectThumb: {
    width: 140, height: 140,
    borderRadius: 12, overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(248,113,113,0.45)",
    marginBottom: 12,
  },
  rejectTitle:  { fontSize: 16, fontWeight: "700", color: c.danger, marginTop: 12 },
  rejectTip:    { fontSize: 13.5, color: c.textDim, textAlign: "center", lineHeight: 22, marginVertical: 6 },
  rejectReason: { fontSize: 12, color: c.textMuted, textAlign: "center", lineHeight: 19, fontStyle: "italic", marginTop: 6 },
});
