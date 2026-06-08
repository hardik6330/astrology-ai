// Onboarding step shown between the birth-detail form and the kundali
// reading. The user picks a hand (right/left) and then a source (camera
// or gallery), mirroring the main PalmScreen. Skipping at any point
// takes them straight to the Insights reading.
// Hand-side is a UI label only — not sent to AI.

import React, { useState, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Modal, BackHandler } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import ScreenContainer from "../../components/ScreenContainer";
import CosmicCard from "../../components/CosmicCard";
import { useChart } from "../../context/ChartContext";
import { analyzePalm } from "../../services/api";
import { useColors } from "../../theme/ThemeContext";
import { useStyles } from "../../theme/useStyles";
import { radius, spacing, fontSize } from "../../theme/tokens";
import { gatePalmImage, warmUpGate } from "./palmGate";
import MagicButton from "../../components/MagicButton";
import { haptics } from "../../utils/haptics";
import { compressPhoto } from "../../utils/compressImage";

export default function PalmStepScreen({ navigation }) {
  const { 
    form, setPalm, setPalmComparison, setPalmPhoto, 
    setPalmAnalyzing, setPalmClaimedHand, setPalmLandmarks 
  } = useChart();
  const color = useColors();
  const s = useStyles(makeStyles);
  const [busy, setBusy] = useState(false);
  // True only while the native camera is opening (permission + cold launch),
  // separate from `busy` which also spans the gate + analysis. Drives the
  // "Opening camera…" spinner on the picker button, matching PalmScreen.
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");
  // Which hand the user tapped — when set, the source-picker modal is open.
  const [activeHand, setActiveHand] = useState(null); // "Right" | "Left" | null

  // Warm up the detector.
  useEffect(() => { warmUpGate(); }, []);

  // Custom hardware back behavior for onboarding
  useFocusEffect(
    React.useCallback(() => {
      const onBack = () => {
        // Go back to Step 2 of Home
        navigation.navigate("Home", { step: 2 });
        return true;
      };
      const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
      return () => sub.remove();
    }, [navigation])
  );

  // Both paths (upload + skip) land on the Reading "Insights" tab. When a
  // palm photo was provided we kick off the analysis in the background so the
  // result is ready in ChartContext.palm by the time the user opens Palm.
  function goToReading() {
    setActiveHand(null);
    navigation.navigate("Reading", { tab: "reading" });
  }

  function goToPalm() {
    setActiveHand(null);
    navigation.navigate("Palm");
  }

  function analyzeInBackground(base64, hand) {
    setPalmAnalyzing(true);
    analyzePalm(`data:image/jpeg;base64,${base64}`, form, hand)
      .then((result) => setPalm(result))
      .catch(() => { /* surfaced on Palm if the user visits it */ })
      .finally(() => setPalmAnalyzing(false));
  }

  async function pick(source) {
    setError("");
    // Immediate feedback: spinner on the button while we ask for permission
    // and the native camera cold-launches. Cleared the moment it's up.
    setLaunching(true);
    const perm =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setLaunching(false);
      setError(source === "camera" ? "Camera permission denied." : "Photo permission denied.");
      return;
    }
    setBusy(true);
    try {
      const opts = {
        mediaTypes: ["images"],
        base64: true,
        quality: 0.75,
        allowsEditing: false,
        exif: true, // camera-origin signal for the gate's anti-screen-photo check
      };
      const res = source === "camera"
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
      setLaunching(false); // camera returned — gate/analysis takes over below
      // Cancel the camera/gallery → keep the source picker open so the
      // user can pick a different option without re-selecting hand.
      if (res.canceled) {
        setBusy(false);
        return;
      }
      const a = res.assets[0];
      
      // Client-side gate check
      const gateResult = await gatePalmImage(a, activeHand);
      setPalmLandmarks({
        keypoints: gateResult.landmarks,
        imgW: gateResult.imgW,
        imgH: gateResult.imgH,
      });
      // We don't have a direct way to pass gateReport to PalmScreen via context 
      // without adding a new context state, but since the analysis is in background, 
      // the user won't see the gate checklist on this screen.
      if (!gateResult.ok) {
        setError(gateResult.retakeReason);
        haptics.warning();
        setBusy(false);
        setActiveHand(null); // Hide drawer on failure
        return;
      }

      const img = await compressPhoto(a);
      // Clear old data so PalmScreen shows the scanning animation for the new photo
      setPalm(null);
      setPalmComparison(null);
      setPalmPhoto(img.uri);
      setPalmClaimedHand(activeHand);   // share with PalmScreen for the scan-screen badge
      // activeHand is "Right" | "Left" — already in the right shape.
      analyzeInBackground(img.base64, activeHand);
      goToPalm();
    } catch {
      setError("Couldn't open the picker.");
    } finally {
      setBusy(false);
      setLaunching(false);
    }
  }

  return (
    <ScreenContainer showMenu={false}>
      <Pressable 
        onPress={() => navigation.navigate("Home", { step: 2 })}
        style={({ pressed }) => [s.backIcon, pressed && { opacity: 0.6 }]}
      >
        <Ionicons name="chevron-back" size={28} color={color.text} />
      </Pressable>

      <View style={{ alignItems: "center", marginBottom: spacing.lg }}>
        <Text style={s.title}>Add a Palm Reading?</Text>
        <Text style={s.subtitle}>
          Optional — we&apos;ll analyse your palm while your kundali is being built.
        </Text>
      </View>

      <CosmicCard>
        <View style={{ gap: spacing.md }}>
          <Pressable
            onPress={() => navigation.navigate("PalmCompare")}
            disabled={busy}
            style={({ pressed }) => [s.bothBtn, pressed && { opacity: 0.85 }, busy && { opacity: 0.5 }]}
          >
            {/* Split the two emojis into their own Text views — joined
                "✋🤚" clips the second glyph on some Android emoji fonts. */}
            <View style={s.bothIconWrap}>
              <Text style={s.bothIconGlyph}>✋</Text>
              <Text style={s.bothIconGlyph}>🤚</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.handLabel}>Both Hands · Full Life Comparison</Text>
              <Text style={[s.handSub, { color: color.primaryLight }]}>
                Compare your inborn potential against your current reality
              </Text>
            </View>
            <Text style={[s.chev, { color: color.primaryLight }]}>›</Text>
          </Pressable>

          <HandButton
            icon="✋"
            label="Right Hand"
            sublabel="Tap to add a photo of your right palm"
            onPress={() => setActiveHand("Right")}
            disabled={busy}
            color={color}
            styles={s}
          />
          <HandButton
            icon="🤚"
            label="Left Hand"
            sublabel="Tap to add a photo of your left palm"
            onPress={() => setActiveHand("Left")}
            disabled={busy}
            color={color}
            styles={s}
          />
          <Pressable
            onPress={goToReading}
            disabled={busy}
            style={({ pressed }) => [s.skipBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={s.skipText}>Skip → Go to my kundali</Text>
          </Pressable>
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}
      </CosmicCard>

      <Text style={s.note}>
        Tip: bright, even lighting and a clear view of the palm work best.
      </Text>

      {/* Source picker modal — camera only (no gallery) so users can't submit a
          photo of a screen/another picture. Mirrors PalmScreen. */}
      <Modal
        visible={activeHand !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveHand(null)}
      >
        <Pressable
          onPress={() => !busy && setActiveHand(null)}
          style={s.modalBackdrop}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={s.modalSheet}
          >
            <Text style={s.modalTitle}>
              {activeHand} Hand · Take a live photo of your palm
            </Text>

            <Pressable
              onPress={() => pick("camera")}
              disabled={busy}
              style={({ pressed }) => [s.sourceBtn, s.sourceBtnPrimary, (pressed || busy) && { opacity: 0.85 }]}
            >
              {launching ? (
                <>
                  <ActivityIndicator color={color.primaryLight} style={s.sourceIcon} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.sourceLabel}>Opening camera…</Text>
                    <Text style={s.sourceSub}>Hold on a moment</Text>
                  </View>
                </>
              ) : (
                <>
                  <Text style={s.sourceIcon}>📷</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.sourceLabel}>Take a Photo</Text>
                    <Text style={s.sourceSub}>For an accurate reading we use a live camera shot, not gallery uploads</Text>
                  </View>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={() => setActiveHand(null)}
              disabled={busy}
              style={({ pressed }) => [s.modalCancel, pressed && { opacity: 0.7 }]}
            >
              <Text style={s.modalCancelText}>Cancel</Text>
            </Pressable>

            {busy && !launching && (
              <View style={{ flexDirection: "row", justifyContent: "center", marginTop: spacing.sm, gap: 8 }}>
                <ActivityIndicator color={color.primaryLight} />
                <Text style={{ color: color.textDim, fontSize: 13 }}>Checking photo…</Text>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

function HandButton({ icon, label, sublabel, onPress, disabled, color, styles: s }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [s.handBtn, pressed && { opacity: 0.7 }, disabled && { opacity: 0.5 }]}
    >
      <Text style={s.handIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.handLabel}>{label}</Text>
        <Text style={s.handSub}>{sublabel}</Text>
      </View>
      <Text style={[s.chev, { color: color.primaryLight }]}>›</Text>
    </Pressable>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    title:    { color: c.text, fontSize: 22, fontWeight: "800", textAlign: "center", marginTop: spacing.md },
    subtitle: { color: c.textDim, fontSize: 13, textAlign: "center", marginTop: 6, paddingHorizontal: spacing.lg, lineHeight: 19 },

    handBtn: {
      flexDirection: "row", alignItems: "center", gap: spacing.md,
      paddingVertical: 16, paddingHorizontal: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1, borderColor: c.primaryBorder,
      backgroundColor: c.primarySoft,
    },
    // Premium-flavored variant for the Both-Hands entry — slightly brighter
    // border + glow vs. the single-hand cards so it reads as the headline.
    bothBtn: {
      flexDirection: "row", alignItems: "center", gap: spacing.md,
      paddingVertical: 16, paddingHorizontal: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1.5, borderColor: c.primaryLight,
      backgroundColor: c.primarySoft,
    },
    handIcon: {
      fontSize: 28, lineHeight: 38,
      width: 44, height: 40,
      textAlign: "center", textAlignVertical: "center",
      includeFontPadding: false,
    },
    // Wider variant for the Both-Hands button — single-emoji handIcon's
    // width (44) clips the second emoji of "✋🤚".
    bothIcon: {
      fontSize: 26, lineHeight: 38,
      width: 64, height: 40,
      textAlign: "center", textAlignVertical: "center",
      includeFontPadding: false,
    },
    // Wrapper that holds the two split emoji Text views side by side, so
    // each glyph has its own layout box (works around the Android clipping
    // of the joined "✋🤚" run).
    bothIconWrap: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      width: 64, height: 40,
    },
    bothIconGlyph: {
      fontSize: 22, lineHeight: 32, marginHorizontal: 1,
      includeFontPadding: false,
    },
    handLabel: { color: c.text, fontSize: 15, fontWeight: "700" },
    handSub:   { color: c.textMuted, fontSize: 12, marginTop: 2 },
    chev:      { fontSize: 26, fontWeight: "700", paddingHorizontal: 6 },

    skipBtn: {
      marginTop: spacing.sm,
      paddingVertical: 12, paddingHorizontal: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1, borderColor: c.cardBorder,
      alignItems: "center",
    },
    skipText: {
      color: c.textMuted,
      fontSize: 14,
      fontWeight: "600",
      textDecorationLine: "underline",
    },
    btnRow: {
      flexDirection: "row",
      marginTop: spacing.sm,
    },

    error: { color: c.danger, fontSize: 13, marginTop: 12, textAlign: "center" },
    note:  { color: c.textFaint, fontSize: 11, marginTop: spacing.md, textAlign: "center", lineHeight: 16 },

    backIcon: {
      position: "absolute",
      top: 0,
      left: 0,
      zIndex: 10,
      padding: spacing.sm,
    },

    // ── Source-picker modal ────────────────────────────────────────────
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      justifyContent: "flex-end",
    },
    modalSheet: {
      backgroundColor: c.bg,
      borderTopLeftRadius: 22, borderTopRightRadius: 22,
      borderWidth: 1, borderColor: c.primaryBorder,
      paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xl,
      gap: spacing.md,
    },
    modalTitle: {
      color: c.text, fontSize: 14, fontWeight: "600",
      textAlign: "center", marginBottom: 4,
    },
    sourceBtn: {
      flexDirection: "row", alignItems: "center", gap: spacing.md,
      paddingVertical: 14, paddingHorizontal: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1, borderColor: c.cardBorder,
      backgroundColor: c.cardBg,
    },
    sourceBtnPrimary: {
      borderColor: c.primaryBorder,
      backgroundColor: c.primarySoft,
    },
    sourceIcon: {
      fontSize: 26, lineHeight: 36,
      width: 40, textAlign: "center", textAlignVertical: "center",
      includeFontPadding: false,
    },
    sourceLabel: { color: c.text, fontSize: 15, fontWeight: "700" },
    sourceSub:   { color: c.textMuted, fontSize: 12, marginTop: 2 },

    modalCancel: {
      paddingVertical: 12, paddingHorizontal: spacing.md,
      borderRadius: radius.lg,
      alignItems: "center", marginTop: 4,
    },
    modalCancelText: { color: c.textDim, fontSize: 14, fontWeight: "600" },
  });
