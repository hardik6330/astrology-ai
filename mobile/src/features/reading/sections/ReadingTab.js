import React from "react";
import { View, Text } from "react-native";
import CosmicCard from "../../../components/CosmicCard";
import MagicButton from "../../../components/MagicButton";
import LowCreditsCard from "../../../components/LowCreditsCard";
import { SkeletonAIReading } from "../../../components/Skeleton";
import { useColors } from "../../../theme/ThemeContext";
import { useStyles } from "../../../theme/useStyles";
import { useCosts } from "../../../hooks/useCosts";
import { spacing } from "../../../theme/tokens";
import { signOf } from "../../../shared/astrology";
import { asText } from "../constants";
import { makeStyles } from "../styles";

// Reading tab: the AI-generated narrative interpretation. Locked by default
// (an "Unlock for N credits" preview) until the user pays; also handles the
// overloaded / loading / low-credits / loaded states.
export default function ReadingTab({
  interp, loading, overloaded, cooldown, lowCredits, loadMsg, generateReading, navigation, chart, form,
}) {
  const color = useColors();
  const s = useStyles(makeStyles);
  const costs = useCosts();
  const cost = costs?.insights ?? 20;

  return (
    <>
      {lowCredits && !interp && (
        <LowCreditsCard
          cost={cost}
          action="The detailed AI analysis"
          onTopUp={() => navigation.navigate("Profile")}
        />
      )}

      {!interp && !loading && !overloaded && !lowCredits && (
        <CosmicCard style={{ alignItems: "center", paddingVertical: spacing.xl }}>
          <Text style={{ fontSize: 44, lineHeight: 56, marginBottom: 10 }}>✨</Text>
          <Text style={s.lockTitle}>Unlock Your Cosmic Blueprint</Text>
          <Text style={s.lockBody}>
            A deep, personalised AI reading of your chart — core identity, career, relationships,
            strengths, remedies and more.
          </Text>
          <MagicButton style={{ width: "100%", marginTop: spacing.md }} onPress={generateReading}>
            {`Unlock Detailed AI Analysis · ${cost} Credits`}
          </MagicButton>
          <Text style={s.lockNote}>One-time charge per chart. Re-viewing is always free.</Text>
        </CosmicCard>
      )}

      {overloaded && !interp && (
        <CosmicCard style={s.aiBusyCard}>
          <Text style={{ fontSize: 36, lineHeight: 48, textAlign: "center" }}>⏳</Text>
          <Text style={s.aiBusyTitle}>AI is busy right now</Text>
          <Text style={s.aiBusyBody}>
            Our reader couldn't complete your reading after several tries.
            {cooldown > 0 ? " Please wait a moment before trying again." : " You can try again now."}
          </Text>
          <MagicButton onPress={generateReading} disabled={cooldown > 0}>
            {cooldown > 0 ? `🕒 Try Again in ${cooldown}s` : "🔄 Try Again"}
          </MagicButton>
        </CosmicCard>
      )}

      {loading && !interp && (
        <>
          <View style={{ alignItems: "center", marginBottom: spacing.md }}>
            <Text style={{ fontSize: 32, lineHeight: 44 }}>🔮</Text>
            <Text style={s.loadingTitle}>{loadMsg}</Text>
            <Text style={s.loadingSub}>The stars are aligning for you…</Text>
          </View>
          <SkeletonAIReading />
        </>
      )}

      {interp && (
        <>
          {/* ── Cosmic Blueprint hero ─────────────────────────── */}
          <View style={s.blueprint}>
            <Text style={s.blueprintLabel}>COSMIC BLUEPRINT</Text>
            <View style={s.blueprintDivider} />
            <Text style={s.blueprintText}>"{asText(interp.lifeTheme)}"</Text>
            <Text style={s.blueprintFooter}>
              Generated for {form.name || "you"} · {signOf(chart.angles.ascSid)} Lagna
            </Text>
          </View>

          {/* ── Numbered narrative sections ───────────────────── */}
          {[
            { title: "Core Identity",      icon: "✨", body: asText(interp.bigThree),      accent: color.primaryLight },
            { title: "Personality Matrix", icon: "👤", body: asText(interp.personality),   accent: color.accentLight },
            { title: "Destiny & Purpose",  icon: "💼", body: asText(interp.career),        accent: color.warning },
            { title: "Heart & Soul",       icon: "💛", body: asText(interp.relationships), accent: color.danger },
          ].map((sec, i) =>
            sec.body ? (
              <View key={sec.title} style={[s.narrativeCard, { borderLeftColor: sec.accent }]}>
                <View style={s.narrativeHead}>
                  <Text style={{ fontSize: 22, lineHeight: 30, marginRight: 10 }}>{sec.icon}</Text>
                  <Text style={s.narrativeTitle}>{sec.title}</Text>
                </View>
                <Text style={s.narrativeBody}>{sec.body}</Text>
              </View>
            ) : null
          )}

          {/* ── Strengths (full-width chip list) ──────────────── */}
          {interp.strengths?.length > 0 && (
            <View style={s.panelCard}>
              <View style={s.panelHead}>
                <View style={[s.panelDot, { backgroundColor: color.success }]} />
                <Text style={[s.panelTitle, { color: color.success }]}>What's working for you</Text>
              </View>
              {interp.strengths.map((sp, i) => (
                <View key={i} style={[s.chip, { backgroundColor: "rgba(34,197,94,0.06)", borderColor: "rgba(34,197,94,0.25)" }]}>
                  <Text style={[s.chipMark, { color: color.success }]}>✓</Text>
                  <Text style={s.chipText}>{asText(sp)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── Growth zones ─────────────────────────────────── */}
          {interp.challenges?.length > 0 && (
            <View style={s.panelCard}>
              <View style={s.panelHead}>
                <View style={[s.panelDot, { backgroundColor: color.warning }]} />
                <Text style={[s.panelTitle, { color: color.warning }]}>Where you'll grow</Text>
              </View>
              {interp.challenges.map((cg, i) => (
                <View key={i} style={[s.chip, { backgroundColor: "rgba(251,191,36,0.06)", borderColor: "rgba(251,191,36,0.25)" }]}>
                  <Text style={[s.chipMark, { color: color.warning }]}>↑</Text>
                  <Text style={s.chipText}>{asText(cg)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── Key Placements (insight cards) ────────────────── */}
          {interp.keyPlacements?.length > 0 && (
            <View style={s.placementSection}>
              <Text style={s.sectionLabel}>KEY CELESTIAL PLACEMENTS</Text>
              <Text style={s.sectionSub}>The placements doing the heavy lifting in your chart.</Text>
              {interp.keyPlacements.map((k, i) => (
                <View key={i} style={s.placementCard}>
                  <Text style={s.placementBody}>{asText(k)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── Remedies as action steps ──────────────────────── */}
          {interp.remedies?.length > 0 && (
            <View style={s.remedySection}>
              <Text style={[s.sectionLabel, { color: color.primaryLight }]}>🪔  COSMIC GUIDANCE</Text>
              <Text style={s.sectionSub}>Behaviors and timings to align your karma.</Text>
              {interp.remedies.map((r, i) => (
                <View key={i} style={s.remedyRow}>
                  <Text style={s.remedyBody}>{asText(r)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── Footer CTA ────────────────────────────────────── */}
          <View style={s.footerCard}>
            <Text style={s.footerKicker}>STILL CURIOUS?</Text>
            <Text style={s.footerTitle}>Ask your astrologer</Text>
            <Text style={s.footerBody}>
              Pose any follow-up question. The answer is grounded only in your chart.
            </Text>
            <MagicButton style={{ width: "100%", marginTop: spacing.md }} onPress={() => navigation.navigate("Chat")}>
              Open Chat  ↗
            </MagicButton>
          </View>

          <Text style={s.disclaimer}>
            Astrology is a tool for self-reflection. Celestial cycles reflect possibilities, not certainties.
          </Text>
        </>
      )}
    </>
  );
}
