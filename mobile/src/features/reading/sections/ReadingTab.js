import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import CosmicCard from "../../../components/CosmicCard";
import MagicButton from "../../../components/MagicButton";
import LowCreditsCard from "../../../components/LowCreditsCard";
import { SkeletonAIReading } from "../../../components/Skeleton";
import { useColors } from "../../../theme/ThemeContext";
import { useStyles } from "../../../theme/useStyles";
import { useCosts } from "../../../hooks/useCosts";
import { spacing } from "../../../theme/tokens";
import { signOf } from "../../../shared/astrology";
import { EMOJIS } from "../../../utils/emojis";
import { asText } from "../constants";
import { makeStyles } from "../styles";

const COLLAPSED_LINES = 6;

// One narrative section, clamped to ~6 lines with a Show more / Show less
// toggle. We render full once to measure the true line count (onTextLayout),
// then clamp — so the toggle only appears when the body actually overflows.
function NarrativeCard({ sec, s }) {
  const [expanded, setExpanded] = useState(false);
  const [totalLines, setTotalLines] = useState(0);
  const measured = totalLines > 0;
  const canCollapse = totalLines > COLLAPSED_LINES;

  return (
    <View style={[s.narrativeCard, { borderLeftColor: sec.accent }]}>
      <View style={s.narrativeHead}>
        <Text style={{ fontSize: 22, lineHeight: 30, marginRight: 10 }}>{sec.icon}</Text>
        <Text style={s.narrativeTitle}>{sec.title}</Text>
      </View>
      <Text
        style={s.narrativeBody}
        onTextLayout={(e) => { if (!measured) setTotalLines(e.nativeEvent.lines.length); }}
        numberOfLines={measured && canCollapse && !expanded ? COLLAPSED_LINES : undefined}
      >
        {sec.body}
      </Text>
      {canCollapse && (
        <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={8}>
          <Text style={[s.showMore, { color: sec.accent }]}>
            {expanded ? "Show less" : "Show more"}
          </Text>
        </Pressable>
      )}
      {/* "Show your work" — the exact chart factors behind this section. */}
      {sec.evidence ? (
        <View style={s.evidenceBox}>
          <Text style={s.evidenceText}>
            <Text style={s.evidenceLabel}>{EMOJIS.SPARKLES} Astrology logic: </Text>
            {sec.evidence}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// "Timeline Check" — a single grounded yes/no question testing the chart against
// the user's real past (pastCheck.basis is a genuine, computed dasha/transit
// window — not a cold read). HONEST: the acknowledgement reflects the user's
// ACTUAL answer instead of "confirmed" no matter what. Twin of the web's
// TimelineCheck in frontend/src/features/reading/InsightsTab.jsx.
function TimelineCheck({ pastCheck, s }) {
  const [answer, setAnswer] = useState(null);
  if (!pastCheck?.question) return null;

  if (answer) {
    const msg =
      answer === "yes"
        ? `That tracks with your chart — this window is shaped by ${pastCheck.basis || "the active dasha"}. Your reading weighs it accordingly.`
        : "Good to know — the same transit doesn't land the same way for everyone. Your reading focuses on the patterns active for you now.";
    return (
      <View style={s.timelineAck}>
        <Text style={s.timelineAckText}>{(answer === "yes" ? EMOJIS.SPARKLES : "🧭") + " " + msg}</Text>
      </View>
    );
  }

  return (
    <View style={s.timelineCard}>
      <Text style={s.timelineLabel}>{EMOJIS.SPARKLES} TIMELINE CHECK</Text>
      <Text style={s.timelineQuestion}>{pastCheck.question}</Text>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Pressable onPress={() => setAnswer("yes")} style={[s.timelineBtn, s.timelineBtnYes]}>
          <Text style={s.timelineBtnYesText}>{"Yes, that's true"}</Text>
        </Pressable>
        <Pressable onPress={() => setAnswer("no")} style={[s.timelineBtn, s.timelineBtnNo]}>
          <Text style={s.timelineBtnNoText}>No, not really</Text>
        </Pressable>
      </View>
    </View>
  );
}

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
          onTopUp={() => navigation.navigate("Credits")}
        />
      )}

      {!interp && !loading && !overloaded && !lowCredits && (
        <CosmicCard style={{ alignItems: "center", paddingVertical: spacing.xl }}>
          <Text style={{ fontSize: 44, lineHeight: 56, marginBottom: 10 }}>{EMOJIS.SPARKLES}</Text>
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
          <Text style={{ fontSize: 36, lineHeight: 48, textAlign: "center" }}>{EMOJIS.HOURGLASS}</Text>
          <Text style={s.aiBusyTitle}>AI is busy right now</Text>
          <Text style={s.aiBusyBody}>
            Our reader couldn't complete your reading after several tries.
            {cooldown > 0 ? " Please wait a moment before trying again." : " You can try again now."}
          </Text>
          <MagicButton onPress={generateReading} disabled={cooldown > 0}>
            {cooldown > 0 ? `${EMOJIS.CLOCK} Try Again in ${cooldown}s` : `${EMOJIS.REFRESH} Try Again`}
          </MagicButton>
        </CosmicCard>
      )}

      {loading && !interp && (
        <>
          <View style={{ alignItems: "center", marginBottom: spacing.md }}>
            <Text style={{ fontSize: 32, lineHeight: 44 }}>{EMOJIS.CRYSTAL_BALL}</Text>
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

          {interp.pastCheck?.question ? <TimelineCheck pastCheck={interp.pastCheck} s={s} /> : null}

          {/* ── Numbered narrative sections ───────────────────── */}
          {[
            { title: "Core Identity",      icon: EMOJIS.SPARKLES,     body: asText(interp.bigThree),      accent: color.primaryLight },
            { title: "Personality Matrix", icon: EMOJIS.USER,         body: asText(interp.personality),   accent: color.accentLight, evidence: interp.evidence?.personality },
            { title: "Destiny & Purpose",  icon: EMOJIS.BRIEFCASE,    body: asText(interp.career),        accent: color.warning,      evidence: interp.evidence?.career },
            { title: "Heart & Soul",       icon: EMOJIS.HEART_YELLOW, body: asText(interp.relationships), accent: color.danger,       evidence: interp.evidence?.relationships },
          ].map((sec) =>
            sec.body ? <NarrativeCard key={sec.title} sec={sec} s={s} /> : null
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
                  <Text style={[s.chipMark, { color: color.success }]}>{EMOJIS.CHECK}</Text>
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
              <Text style={[s.sectionLabel, { color: color.primaryLight }]}>{EMOJIS.DIYA}  COSMIC GUIDANCE</Text>
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
