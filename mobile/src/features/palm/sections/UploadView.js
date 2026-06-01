import React from "react";
import { View, Text, ActivityIndicator, Animated } from "react-native";
import { Image } from "expo-image";
import CosmicCard from "../../../components/CosmicCard";
import PressableScale from "../../../components/PressableScale";
import { useColors } from "../../../theme/ThemeContext";
import { useStyles } from "../../../theme/useStyles";
import { spacing, fontSize } from "../../../theme/tokens";
import { makeStyles } from "../styles";

// Upload / scanning card. Shows the hand-selection picker before a photo is
// chosen, then the animated scan frame while the analysis runs.
export default function UploadView({
  navigation, setActiveHand, setError, gating, error, preview, scanning, activeHand, scanAnim, scanMsg,
}) {
  const color = useColors();
  const s = useStyles(makeStyles);

  return (
    <CosmicCard style={{ alignItems: "center", padding: spacing.xl }}>
      {!preview && !scanning && (
        <>
          <Text style={{ fontSize: 64, lineHeight: 84, marginBottom: 12, textAlign: "center" }}>✋</Text>
          <Text style={s.uploadTitle}>Scan Your Palm</Text>
          <Text style={s.uploadHint}>
            Pick which hand you're uploading. We'll check the photo matches the hand you choose.
          </Text>

          {/* Premium headline card — Both Hands · Full Life Comparison */}
          <PressableScale
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
          </PressableScale>

          <PressableScale
            onPress={() => { setError(""); setActiveHand("Right"); }}
            style={({ pressed }) => [s.uploadHandBtn, pressed && { opacity: 0.7 }, { marginTop: spacing.sm }]}
          >
            <Text style={s.uploadHandIcon}>✋</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.uploadHandLabel}>Right Hand</Text>
              <Text style={s.uploadHandSub}>Tap to take or pick a photo</Text>
            </View>
            <Text style={[s.chev, { color: color.primaryLight }]}>›</Text>
          </PressableScale>
          <PressableScale
            onPress={() => { setError(""); setActiveHand("Left"); }}
            style={({ pressed }) => [s.uploadHandBtn, pressed && { opacity: 0.7 }, { marginTop: spacing.sm }]}
          >
            <Text style={s.uploadHandIcon}>🤚</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.uploadHandLabel}>Left Hand</Text>
              <Text style={s.uploadHandSub}>Tap to take or pick a photo</Text>
            </View>
            <Text style={[s.chev, { color: color.primaryLight }]}>›</Text>
          </PressableScale>

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
            <Image source={{ uri: preview.uri }} style={s.scanImage} contentFit="cover" transition={200} />
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
  );
}
