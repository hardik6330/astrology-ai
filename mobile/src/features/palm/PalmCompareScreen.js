// Two-hand "Full Life Comparison" flow for mobile. User picks a left
// palm photo, then a right one, then we kick off the comparison analysis
// in the background and navigate to the Reading "Insights" tab. The
// PalmScreen renders the synthesis when the user opens Palm.

import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, Modal, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import ScreenContainer from "../../components/ScreenContainer";
import CosmicCard from "../../components/CosmicCard";
import MagicButton from "../../components/MagicButton";
import { useForm, usePalm } from "../../context/ChartContext";
import { comparePalms } from "../../services/api";
import { useBackToKundali } from "../../utils/useBackToKundali";
import { haptics } from "../../utils/haptics";
import { compressPhoto } from "../../utils/compressImage";
import { useColors } from "../../theme/ThemeContext";
import { useStyles } from "../../theme/useStyles";
import { radius, spacing } from "../../theme/tokens";
import { EMOJIS } from "../../utils/emojis";
import { gatePalmImage, warmUpGate } from "./palmGate";

export default function PalmCompareScreen({ navigation }) {
  const { form } = useForm();
  const {
    setPalmComparison,
    setPalmLeftPhoto, setPalmRightPhoto,
    setPalmAnalyzing,
    setPalmOverloaded,
    setPalmLowCredits,
    setPalmLeftLandmarks, setPalmRightLandmarks,
  } = usePalm();
  const color = useColors();
  const s = useStyles(makeStyles);

  // Android hardware back → Reading/Kundali instead of exiting the app.
  useBackToKundali(navigation);

  // Each side holds { uri, base64 } once the user has picked. base64 is
  // what we send to the backend; uri is for the local preview thumbnail.
  const [left,  setLeft]  = useState(null);
  const [right, setRight] = useState(null);
  const [pickingHand, setPickingHand] = useState(null);   // "left" | "right" | null
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState("");

  // Warm up the detector.
  React.useEffect(() => { warmUpGate(); }, []);

  const ready = !!(left && right);

  async function pickFromSource(source) {
    setError("");
    const perm = source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError(source === "camera" ? "Camera permission denied." : "Photo permission denied.");
      return;
    }
    setBusy(true);
    try {
      const opts = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        base64: true,
        quality: 0.75,
        allowsEditing: false,
        exif: true, // camera-origin signal for the gate's anti-screen-photo check
      };
      const res = source === "camera"
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled) { setBusy(false); return; }
      const a = res.assets[0];
      const hand = pickingHand;

      // Client-side gate check
      const claimedHand = hand === "left" ? "Left" : "Right";
      const gateResult = await gatePalmImage(a, claimedHand);
      if (!gateResult.ok) {
        setError(gateResult.retakeReason);
        haptics.warning();
        setBusy(false);
        setPickingHand(null); // Hide drawer on failure
        return;
      }

      const img = await compressPhoto(a);
      const landmarks = {
        keypoints: gateResult.landmarks,
        imgW: gateResult.imgW,
        imgH: gateResult.imgH,
      };
      setPickingHand(null);
      if (hand === "left")  { 
        setLeft({ uri: img.uri, base64: img.base64 });  
        setPalmLeftPhoto(img.uri); 
        setPalmLeftLandmarks(landmarks);
      }
      if (hand === "right") { 
        setRight({ uri: img.uri, base64: img.base64 }); 
        setPalmRightPhoto(img.uri); 
        setPalmRightLandmarks(landmarks);
      }
    } catch {
      setError("Couldn't open the picker.");
    } finally {
      setBusy(false);
    }
  }

  function analyzeInBackground() {
    setPalmAnalyzing(true);
    setPalmOverloaded(false);
    setPalmLowCredits(false);
    comparePalms(
      `data:image/jpeg;base64,${left.base64}`,
      `data:image/jpeg;base64,${right.base64}`,
      form,
    )
      .then((result) => setPalmComparison(result))
      .catch((err) => {
        if (err?.code === 'AI_OVERLOADED') setPalmOverloaded(true);
        // Out of credits — PalmScreen reads palmLowCredits and shows the card.
        else if (err?.code === 'INSUFFICIENT_CREDITS') setPalmLowCredits(true);
      })
      .finally(() => setPalmAnalyzing(false));
  }

  function submit() {
    if (!ready) return;
    analyzeInBackground();
    navigation.navigate("Reading", { tab: "reading" });
  }

  return (
    <ScreenContainer showMenu={false}>
      <Pressable
        onPress={() => navigation.navigate("Reading", { tab: "kundali" })}
        style={s.backBtn}
      >
        <Text style={s.backText}>← Back</Text>
      </Pressable>

      <View style={{ alignItems: "center", marginBottom: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
          {/* Split the two hand emojis into their own Text views — the
              joined "✋🤚" form clips the second glyph on some Android
              emoji fonts. */}
          <Text style={s.titleEmoji}>{EMOJIS.HAND}</Text>
          <Text style={s.titleEmoji}>{EMOJIS.HAND_LEFT}</Text>
          <Text style={s.title}>  Full Life Comparison</Text>
        </View>
        <Text style={s.subtitle}>
          Compare your left palm (the potential you were born with) against your right
          palm (how your choices have reshaped it). We&apos;ll read the gap between them.
        </Text>
      </View>

      <CosmicCard>
        <View style={{ gap: spacing.md }}>
          {/* LEFT */}
          <Pressable
            onPress={() => setPickingHand("left")}
            disabled={busy}
            style={({ pressed }) => [s.handBtn, pressed && { opacity: 0.7 }]}
          >
            {left ? (
              <Image source={{ uri: left.uri }} style={s.thumb} contentFit="cover" transition={150} />
            ) : (
              <Text style={s.handIcon}>{EMOJIS.HAND_LEFT}</Text>
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.handLabel}>Step 1 · Left Hand</Text>
              <Text style={s.handSub}>
                Potential — what you were born with{left ? " (tap to replace)" : ""}
              </Text>
            </View>
            <Text style={[s.chev, { color: color.primaryLight }]}>{left ? EMOJIS.CHECK : "›"}</Text>
          </Pressable>

          {/* RIGHT */}
          <Pressable
            onPress={() => setPickingHand("right")}
            disabled={busy || !left}
            style={({ pressed }) => [s.handBtn, pressed && { opacity: 0.7 }, !left && { opacity: 0.5 }]}
          >
            {right ? (
              <Image source={{ uri: right.uri }} style={s.thumb} contentFit="cover" transition={150} />
            ) : (
              <Text style={s.handIcon}>{EMOJIS.HAND}</Text>
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.handLabel}>Step 2 · Right Hand</Text>
              <Text style={s.handSub}>
                Reality — what you&apos;ve shaped through choices{right ? " (tap to replace)" : ""}
              </Text>
            </View>
            <Text style={[s.chev, { color: color.primaryLight }]}>{right ? EMOJIS.CHECK : "›"}</Text>
          </Pressable>

          <MagicButton
            style={{ width: "100%", marginTop: spacing.xs, opacity: ready ? 1 : 0.5 }}
            onPress={submit}
            disabled={!ready}
          >
            {EMOJIS.SPARKLES} Read the Evolution
          </MagicButton>
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}
      </CosmicCard>

      <Text style={s.note}>
        Tip: bright, even lighting and a clear view of each palm work best. Photos are analyzed and discarded — never stored.
      </Text>

      {/* Source picker modal */}
      <Modal
        visible={pickingHand !== null}
        transparent
        animationType="fade"
        onRequestClose={() => !busy && setPickingHand(null)}
      >
        <Pressable
          onPress={() => !busy && setPickingHand(null)}
          style={s.modalBackdrop}
        >
          <Pressable onPress={(e) => e.stopPropagation()} style={s.modalSheet}>
            <Text style={s.modalTitle}>
              {pickingHand === "left" ? "Left" : "Right"} Hand · Take a live photo of your palm
            </Text>

            <Pressable
              onPress={() => pickFromSource("camera")}
              disabled={busy}
              style={({ pressed }) => [s.sourceBtn, s.sourceBtnPrimary, pressed && { opacity: 0.85 }, busy && { opacity: 0.6 }]}
            >
              <Text style={s.sourceIcon}>{EMOJIS.CAMERA_LENS}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.sourceLabel}>Take a Photo</Text>
                <Text style={s.sourceSub}>For an accurate reading we use a live camera shot, not gallery uploads</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => setPickingHand(null)}
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

const makeStyles = (c) =>
  StyleSheet.create({
    backBtn: {
      alignSelf: "flex-start",
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
      borderWidth: 1, borderColor: c.accentBorder, backgroundColor: c.accentSoft,
      marginBottom: spacing.md,
    },
    backText: { color: c.accentLight, fontSize: 12, fontWeight: "600" },

    title:    { color: c.text, fontSize: 22, fontWeight: "800", textAlign: "center", marginTop: spacing.md },
    // Standalone Text per emoji — gives each glyph its own bounding box so
    // Android doesn't clip the second when "✋🤚" are rendered as one run.
    titleEmoji: { fontSize: 22, lineHeight: 32, marginTop: spacing.md, marginHorizontal: 2, includeFontPadding: false },
    subtitle: { color: c.textDim, fontSize: 13, textAlign: "center", marginTop: 6, paddingHorizontal: spacing.lg, lineHeight: 19 },

    handBtn: {
      flexDirection: "row", alignItems: "center", gap: spacing.md,
      paddingVertical: 14, paddingHorizontal: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1, borderColor: c.primaryBorder,
      backgroundColor: c.primarySoft,
    },
    handIcon: { fontSize: 28, lineHeight: 38, width: 56, height: 56, textAlign: "center", textAlignVertical: "center", includeFontPadding: false },
    thumb:    { width: 56, height: 56, borderRadius: 10, borderWidth: 1, borderColor: c.primaryBorder },
    handLabel:{ color: c.text, fontSize: 15, fontWeight: "700" },
    handSub:  { color: c.textMuted, fontSize: 12, marginTop: 2 },
    chev:     { fontSize: 22, fontWeight: "700", paddingHorizontal: 6 },

    error: { color: c.danger, fontSize: 13, marginTop: 12, textAlign: "center" },
    note:  { color: c.textFaint, fontSize: 11, marginTop: spacing.md, textAlign: "center", lineHeight: 16 },

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
  });
