import React from "react";
import { View, Text, Pressable, ActivityIndicator, Animated } from "react-native";
import { Image } from "expo-image";
import CosmicCard from "../../../components/CosmicCard";
import MagicButton from "../../../components/MagicButton";
import { useColors } from "../../../theme/ThemeContext";
import { useStyles } from "../../../theme/useStyles";
import { spacing } from "../../../theme/tokens";
import { REJECT_INFO } from "../constants";
import { EMOJIS } from "../../../utils/emojis";
import { makeStyles } from "../styles";
import { usePalm } from "../../../context/ChartContext";
import PalmSkeletonOverlay from "../../../components/PalmSkeletonOverlay";

// Both-Hands "Full Life Comparison" view. Four states: analyzing, Pro
// overloaded, either hand unusable, or ready. Rendered inside ScreenContainer.
export default function CompareView({
  palmComparison, palmLeftPhoto, palmRightPhoto, palmAnalyzing, palmOverloaded,
  cooldown, scanMsg, scanAnim,
  setPalmComparison, setPalmLeftPhoto, setPalmRightPhoto, setPalmAnalyzing, setPalmOverloaded,
  navigation, reset,
}) {
  const color = useColors();
  const s = useStyles(makeStyles);
  const { palmLeftLandmarks, palmRightLandmarks } = usePalm();

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
    <>
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
                  {uri ? <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="contain" transition={200} /> : null}
                  {palmAnalyzing && !palmComparison && uri ? (
                    <>
                      {hand === "Left" && palmLeftLandmarks && (
                        <PalmSkeletonOverlay landmarks={palmLeftLandmarks} />
                      )}
                      {hand === "Right" && palmRightLandmarks && (
                        <PalmSkeletonOverlay landmarks={palmRightLandmarks} />
                      )}
                      <Animated.View style={{
                        position: "absolute", left: 0, right: 0, height: 2,
                        backgroundColor: "#c084fc",
                        zIndex: 20,
                        top: scanAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["0%", "97%"],
                        }),
                      }} />
                    </>
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
            {cooldown > 0 ? `${EMOJIS.CLOCK} Try Again in ${cooldown}s` : `${EMOJIS.REFRESH} Try Again`}
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
          <CosmicCard style={{ borderColor: "rgba(248,113,113,0.4)", backgroundColor: "rgba(248,113,113,0.06)", elevation: 0 }}>
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
              {EMOJIS.CAMERA_LENS} Retake Both Photos
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
            ["Life Line",  EMOJIS.LEAF,         cmp.lifeLine],
            ["Head Line",  EMOJIS.BRAIN,        cmp.headLine],
            ["Heart Line", EMOJIS.HEART_YELLOW, cmp.heartLine],
            ["Fate Line",  EMOJIS.SATURN,       cmp.fateLine],
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
            <View style={{ flexDirection: "row", gap: spacing.md, marginBottom: spacing.md }}>
              {cmp.grownStronger?.length > 0 && (
                <CosmicCard style={[s.halfCard, { borderColor: "rgba(34,197,94,0.2)", flex: 1, marginBottom: 0 }]}>
                  <Text style={[s.halfTitle, { color: color.success }]}>{EMOJIS.STAR4} Grown Stronger</Text>
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
                  <Text style={[s.halfTitle, { color: color.warning }]}>{EMOJIS.STAR4} Still Showing Up</Text>
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
              <Text style={[s.cardTitle, { color: color.primaryLight }]}>{EMOJIS.TARGET} Direction</Text>
              <Text style={s.lineBody}>{cmp.lifeAdvice}</Text>
            </CosmicCard>
          ) : null}

          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <Pressable onPress={resetCompare} style={[s.revealBtn, { flex: 1, marginBottom: 0 }]}>
              <Text style={s.revealText}>{EMOJIS.REFRESH} Re-do Comparison</Text>
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
               <Text style={[s.revealText, { color: "#94a3b8" }]}>{EMOJIS.HAND_OPEN} Scan Different Hand</Text>
             </Pressable>
          </View>

          <Text style={s.disclaimer}>
            Palmistry is a tool for self-reflection. Insights here are interpretive, not predictive.
          </Text>
        </>
      )}
    </>
  );
}
