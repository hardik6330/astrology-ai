import React from "react";
import { View, Text, ActivityIndicator, Animated } from "react-native";
import { Image } from "expo-image";
import CosmicCard from "../../../components/CosmicCard";
import PressableScale from "../../../components/PressableScale";
import { useColors } from "../../../theme/ThemeContext";
import { useStyles } from "../../../theme/useStyles";
import { spacing, fontSize } from "../../../theme/tokens";
import { EMOJIS } from "../../../utils/emojis";
import { makeStyles } from "../styles";
import PalmSkeletonOverlay from "../../../components/PalmSkeletonOverlay";
import GateChecklist from "./GateChecklist";

// Upload / scanning card. Shows the hand-selection picker before a photo is
// chosen, then the animated scan frame while the analysis runs.
export default function UploadView({
  navigation, setActiveHand, setError, gating, error, preview, scanning, activeHand, claimedHand, scanAnim, scanMsg,
  palmCost = 30, cannotAfford = false, palmLandmarks, gateReport, gateConfidence,
}) {
  const color = useColors();
  const s = useStyles(makeStyles);

  return (
    <CosmicCard style={{ alignItems: "center", padding: spacing.xl }}>
      {!preview && !scanning && (
        <>
          <Text style={{ fontSize: 64, lineHeight: 84, marginBottom: 12, textAlign: "center" }}>{EMOJIS.HAND}</Text>
          <Text style={s.uploadTitle}>Scan Your Palm</Text>
          <Text style={s.uploadHint}>
            Pick which hand you're uploading. We'll check the photo matches the hand you choose.
          </Text>

          {/* Cost reminder — palm reading is a charged AI action. */}
          <View style={s.costPill}>
            <Text style={[s.costPillText, { color: color.primaryLight }]}>{EMOJIS.SPARKLES} {palmCost} credits per reading</Text>
          </View>

          {/* Premium headline card — Both Hands · Full Life Comparison */}
          <PressableScale
            onPress={() => navigation.navigate("PalmCompare")}
            disabled={cannotAfford}
            style={({ pressed }) => [s.uploadBothBtn, (pressed || cannotAfford) && { opacity: cannotAfford ? 0.5 : 0.85 }, { marginTop: spacing.md }]}
          >
            {/* Split glyphs to avoid Android clipping of joined "✋🤚". */}
            <View style={s.uploadBothIconWrap}>
              <Text style={s.uploadBothIconGlyph}>{EMOJIS.HAND}</Text>
              <Text style={s.uploadBothIconGlyph}>{EMOJIS.HAND_LEFT}</Text>
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
            disabled={cannotAfford}
            style={({ pressed }) => [s.uploadHandBtn, (pressed || cannotAfford) && { opacity: cannotAfford ? 0.5 : 0.7 }, { marginTop: spacing.sm }]}
          >
            <Text style={s.uploadHandIcon}>{EMOJIS.HAND}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.uploadHandLabel}>Right Hand</Text>
              <Text style={s.uploadHandSub}>Tap to take or pick a photo</Text>
            </View>
            <Text style={[s.chev, { color: color.primaryLight }]}>›</Text>
          </PressableScale>
          <PressableScale
            onPress={() => { setError(""); setActiveHand("Left"); }}
            disabled={cannotAfford}
            style={({ pressed }) => [s.uploadHandBtn, (pressed || cannotAfford) && { opacity: cannotAfford ? 0.5 : 0.7 }, { marginTop: spacing.sm }]}
          >
            <Text style={s.uploadHandIcon}>{EMOJIS.HAND_LEFT}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.uploadHandLabel}>Left Hand</Text>
              <Text style={s.uploadHandSub}>Tap to take or pick a photo</Text>
            </View>
            <Text style={[s.chev, { color: color.primaryLight }]}>›</Text>
          </PressableScale>

          {/* Privacy assurance — TRUE to the backend: palmService persists only a
              hash + the text reading, never the image bytes. Worded to match
              reality (no "encrypted at rest" claim). */}
          <View style={s.privacyRow}>
            <Text style={s.privacyIcon}>{EMOJIS.LOCK || "🔒"}</Text>
            <Text style={s.privacyText}>
              Analyzed in real time · your photo is never saved — only the reading is kept.
            </Text>
          </View>

          {/* While the gate runs: a plain spinner only — the scored checklist
              lives on the scanning screen, never here. */}
          {gating && (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.md }}>
              <ActivityIndicator size="small" color={color.primaryLight} />
              <Text style={{ color: color.textDim, fontSize: fontSize.sm }}>Reading photo…</Text>
            </View>
          )}

          {/* Rejection: just the retake reason, no numbers. */}
          {error && !gating && (
            <Text style={[s.error, { textAlign: "center", marginTop: spacing.md }]}>{error}</Text>
          )}
        </>
      )}

      {preview && scanning && (
        <View style={{ alignItems: "center", width: "100%" }}>
          {(() => {
            // Badge falls back to the context-held claimed hand so a scan
            // kicked off on PalmStepScreen still shows its hand here, even
            // though the local drawer state (activeHand) is cleared.
            const badgeHand = activeHand || claimedHand;
            return badgeHand ? (
              <View style={s.handBadge}>
                <Text style={s.handBadgeIcon}>{badgeHand === "Right" ? EMOJIS.HAND : EMOJIS.HAND_LEFT}</Text>
                <Text style={s.handBadgeText}>{badgeHand} Hand</Text>
              </View>
            ) : null;
          })()}
          <View style={[s.scanFrame, palmLandmarks && { aspectRatio: palmLandmarks.imgW / palmLandmarks.imgH }]}>
            <Image source={{ uri: preview.uri }} style={s.scanImage} contentFit="contain" transition={200} />
            {scanning && palmLandmarks && (
              <PalmSkeletonOverlay landmarks={palmLandmarks} />
            )}
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

          {/* Web-style gate checklist + analyzing pill — shown ONLY here, on the
              scanning screen. Each label carries its score; the final purple
              pill is the live "Analyzing palm lines with AI…" row. */}
          <GateChecklist checks={gateReport || []} analyzing confidence={gateConfidence} analyzingLabel={scanMsg} />
          <Text style={[s.scanSub, { marginTop: spacing.sm }]}>This usually takes 10–30 seconds.</Text>
        </View>
      )}
    </CosmicCard>
  );
}
