import React from "react";
import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import CosmicCard from "../../../components/CosmicCard";
import { useColors } from "../../../theme/ThemeContext";
import { useStyles } from "../../../theme/useStyles";
import { spacing } from "../../../theme/tokens";
import { EMOJIS } from "../../../utils/emojis";
import { makeStyles } from "../styles";

// "Palmistry Math" chips — formatted from the MEASURED geometry buckets the
// backend computed from the 21 hand landmarks (never model guesses). Keep in
// sync with frontend/src/features/palm/sections/ReadingResult.jsx.
function geometryChips(geo) {
  if (!geo) return [];
  const chips = [];
  if (geo.element) chips.push(`${geo.element} hand`);
  if (geo.palmShape) chips.push(`${geo.palmShape} palm`);
  if (geo.fingerLength) chips.push(`${geo.fingerLength} fingers`);
  if (geo.dominantFinger && geo.dominantFinger !== "balanced") chips.push(`${geo.dominantFinger}`);
  if (geo.thumb) chips.push(`${geo.thumb} thumb`);
  if (geo.mercury) chips.push(`Mercury (pinky) ${geo.mercury}`);
  return chips;
}

// Single-hand palm reading result: photo, summary vibe, per-line cards,
// strengths/watch-outs, practical guidance and classical notes.
export default function ReadingResult({ palm, preview, reset }) {
  const color = useColors();
  const s = useStyles(makeStyles);
  const geoChips = geometryChips(palm.geometry);

  return (
    <>
      {preview && (
        <CosmicCard style={{ padding: 14, alignItems: "center" }}>
          {palm.handType && palm.handType !== "Unclear" ? (
            <View style={s.handBadge}>
              <Text style={s.handBadgeIcon}>{palm.handType === "Right" ? EMOJIS.HAND : EMOJIS.HAND_LEFT}</Text>
              <Text style={s.handBadgeText}>{palm.handType} Hand</Text>
            </View>
          ) : null}
          <View style={s.palmPhoto}>
            <Image source={{ uri: preview.uri }} style={{ width: "100%", aspectRatio: 3 / 4 }} contentFit="cover" transition={200} />
          </View>
        </CosmicCard>
      )}

      <View style={s.summary}>
        <Text style={s.summaryLabel}>
          {palm.handType} Hand · {palm.imageQuality}
        </Text>
        <Text style={s.summaryVibe}>"{palm.overallVibe}"</Text>
      </View>

      {geoChips.length > 0 && (
        <CosmicCard style={{ borderColor: "rgba(168,85,247,0.25)" }}>
          <Text style={[s.cardTitle, { color: color.primaryLight }]}>{EMOJIS.RULER || "📏"} Palmistry Math</Text>
          <Text style={s.cardSub}>Measured from 21 hand landmarks — the geometry behind your reading.</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
            {geoChips.map((chip) => (
              <View key={chip} style={s.geoChip}>
                <Text style={s.geoChipText}>{chip}</Text>
              </View>
            ))}
          </View>
        </CosmicCard>
      )}

      {[
        ["Life Line",      EMOJIS.LEAF,         palm.lifeLine],
        ["Head Line",      EMOJIS.BRAIN,        palm.headLine],
        ["Heart Line",     EMOJIS.HEART_YELLOW, palm.heartLine],
        ["Fate Line",      EMOJIS.SATURN,       palm.fateLine],
        ["Mount of Venus", EMOJIS.SPARKLES,     palm.mountOfVenus],
        ["Marriage Lines", EMOJIS.RING,         palm.marriageLines],
      ].map(([title, icon, content]) =>
        content ? (
          <CosmicCard key={title}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <Text style={s.lineIcon}>{icon}</Text>
              <Text style={s.lineTitle}>{title}</Text>
            </View>
            <Text style={s.lineBody}>{content}</Text>
          </CosmicCard>
        ) : null
      )}

      {(palm.strengths?.length > 0 || palm.watchOuts?.length > 0) && (
        <View style={{ flexDirection: "row", gap: spacing.md, marginBottom: spacing.md }}>
          {palm.strengths?.length > 0 && (
            <CosmicCard style={[s.halfCard, { borderColor: "rgba(34,197,94,0.2)", flex: 1, marginBottom: 0 }]}>
              <Text style={[s.halfTitle, { color: color.success }]}>{EMOJIS.STAR4} Strengths</Text>
              {palm.strengths.map((sp, i) => (
                <View key={i} style={s.bulletRow}>
                  <Text style={{ color: color.success, fontWeight: "700", marginRight: 6 }}>{EMOJIS.CHECK}</Text>
                  <Text style={s.bulletText}>{sp}</Text>
                </View>
              ))}
            </CosmicCard>
          )}
          {palm.watchOuts?.length > 0 && (
            <CosmicCard style={[s.halfCard, { borderColor: "rgba(251,191,36,0.2)", flex: 1, marginBottom: 0 }]}>
              <Text style={[s.halfTitle, { color: color.warning }]}>{EMOJIS.STAR4} Watch For</Text>
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
          <Text style={[s.cardTitle, { color: color.primaryLight }]}>{EMOJIS.TARGET} Practical Guidance</Text>
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
          <Text style={[s.cardTitle, { color: color.accentLight }]}>{EMOJIS.SCROLL} Classical Palmistry Notes</Text>
          <Text style={s.cardSub}>Traditional rules cross-checked against your reading.</Text>
          {palm.palmistryNotes.map((n, i) => (
            <View key={i} style={s.noteRow}>
              <Text style={{ color: color.accentLight, fontWeight: "700", marginRight: 6 }}>{EMOJIS.CHECK}</Text>
              <Text style={s.noteText}>{n}</Text>
            </View>
          ))}
        </CosmicCard>
      )}

      <Pressable onPress={reset} style={s.revealBtn}>
        <Text style={s.revealText}>{EMOJIS.REFRESH} Scan a Different Palm</Text>
      </Pressable>

      <Text style={s.disclaimer}>
        Palmistry is a tool for self-reflection. Insights here are interpretive, not predictive.
      </Text>
    </>
  );
}
