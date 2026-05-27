// Onboarding step shown between the birth-detail form and the kundali
// reading. The user picks a hand (right/left) and then a source (camera
// or gallery), mirroring the main PalmScreen. Skipping at any point
// takes them straight to the All Over reading.
// Hand-side is a UI label only — not sent to AI.

import React, { useState, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Modal } from "react-native";
import * as ImagePicker from "expo-image-picker";
import ScreenContainer from "../components/ScreenContainer";
import CosmicCard from "../components/CosmicCard";
import { useChart } from "../context/ChartContext";
import { analyzePalm } from "../services/api";
import { useColors } from "../theme/ThemeContext";
import { useStyles } from "../theme/useStyles";
import { radius, spacing } from "../theme/tokens";
import { gatePalmImage, warmUpGate } from "../utils/palmGate";

export default function PalmStepScreen({ navigation }) {
  const { form, setPalm, setPalmComparison, setPalmPhoto, setPalmAnalyzing, setPalmClaimedHand } = useChart();
  const color = useColors();
  const s = useStyles(makeStyles);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Which hand the user tapped — when set, the source-picker modal is open.
  const [activeHand, setActiveHand] = useState(null); // "Right" | "Left" | null

  // Warm up the detector.
  useEffect(() => { warmUpGate(); }, []);

  // Both paths (upload + skip) land on the Reading "All Over" tab. When a
  // palm photo was provided we kick off the analysis in the background so the
  // result is ready in ChartContext.palm by the time the user opens Palm.
  function goToReading() {
    setActiveHand(null);
    navigation.navigate("Reading", { tab: "reading" });
  }

  function goToPalm() {
    setActiveHand(null);
    navigation.navigate("Reading", { tab: "palm" });
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
    const perm =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
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
      };
      const res = source === "camera"
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
      // Cancel the camera/gallery → keep the source picker open so the
      // user can pick a different option without re-selecting hand.
      if (res.canceled) {
        setBusy(false);
        return;
      }
      const a = res.assets[0];
      
      // Client-side gate check
      const gateResult = await gatePalmImage(a, activeHand);
      if (!gateResult.ok) {
        setError(gateResult.retakeReason);
        setBusy(false);
        return;
      }

      // Clear old data so PalmScreen shows the scanning animation for the new photo
      setPalm(null);
      setPalmComparison(null);
      setPalmPhoto(a.uri);
      setPalmClaimedHand(activeHand);   // share with PalmScreen for the scan-screen badge
      // activeHand is "Right" | "Left" — already in the right shape.
      analyzeInBackground(a.base64, activeHand);
      goToPalm();
    } catch {
      setError("Couldn't open the picker.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenContainer showMenu={false}>
      <View style={{ alignItems: "center", marginBottom: spacing.lg }}>
        <Text style={s.title}>Add a Palm Reading?</Text>
        <Text style={s.subtitle}>
          Optional — we'll analyse your palm while your kundali is being built.
        </Text>
      </View>

      <CosmicCard>
        <View style={{ gap: spacing.md }}>
          <Pressable
            onPress={() => navigation.navigate("PalmCompare")}
            disabled={busy}
            style={({ pressed }) => [s.bothBtn, pressed && { opacity: 0.85 }, busy && { opacity: 0.5 }]}
          >
            <Text style={s.handIcon}>✋🤚</Text>
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

      {/* Source picker modal — mirrors the camera/gallery buttons on PalmScreen */}
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
              {activeHand} Hand · How would you like to add the photo?
            </Text>

            <Pressable
              onPress={() => pick("camera")}
              disabled={busy}
              style={({ pressed }) => [s.sourceBtn, s.sourceBtnPrimary, pressed && { opacity: 0.85 }, busy && { opacity: 0.6 }]}
            >
              <Text style={s.sourceIcon}>📷</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.sourceLabel}>Take a Photo</Text>
                <Text style={s.sourceSub}>Use your camera</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => pick("library")}
              disabled={busy}
              style={({ pressed }) => [s.sourceBtn, pressed && { opacity: 0.85 }, busy && { opacity: 0.6 }]}
            >
              <Text style={s.sourceIcon}>🖼️</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.sourceLabel}>Upload from Device</Text>
                <Text style={s.sourceSub}>Pick a photo from your gallery</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => setActiveHand(null)}
              disabled={busy}
              style={({ pressed }) => [s.modalCancel, pressed && { opacity: 0.7 }]}
            >
              <Text style={s.modalCancelText}>Cancel</Text>
            </Pressable>

            {busy && (
              <View style={{ flexDirection: "row", justifyContent: "center", marginTop: spacing.sm, gap: 8 }}>
                <ActivityIndicator color={color.primaryLight} />
                <Text style={{ color: color.textDim, fontSize: 13 }}>Opening picker…</Text>
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
    skipText: { color: c.textDim, fontSize: 14, fontWeight: "600" },

    error: { color: c.danger, fontSize: 13, marginTop: 12, textAlign: "center" },
    note:  { color: c.textFaint, fontSize: 11, marginTop: spacing.md, textAlign: "center", lineHeight: 16 },

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
