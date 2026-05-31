import React from "react";
import { View, Text } from "react-native";
import CosmicCard from "../../../components/CosmicCard";
import DashaWheel from "../../kundali/DashaWheel";
import AshtakvargaWheel from "../../kundali/AshtakvargaWheel";
import { useColors } from "../../../theme/ThemeContext";
import { useStyles } from "../../../theme/useStyles";
import { fontSize } from "../../../theme/tokens";
import { ZE, fmtDate } from "../../../shared/astrology";
import { makeStyles } from "../styles";

// Timeline tab: dasha + ashtakvarga wheels, the dasha-window forecast,
// prediction-confidence breakdown, and the current sky (gochar) transits.
export default function TimelineTab({ chart }) {
  const color = useColors();
  const s = useStyles(makeStyles);

  return (
    <>
      {/* New: Dasha Timeline Wheel */}
      <DashaWheel chart={chart} />

      {/* New: Ashtakvarga Wheel */}
      <AshtakvargaWheel ashtakvarga={chart.ashtakvarga} />

      <CosmicCard>
        <Text style={s.cardTitle}>Timeline Forecast</Text>
        <Text style={s.cardSub}>Upcoming dasha windows with the reasoning.</Text>
        {chart.predictions.map((p, i) => {
          const tc = p.tone === "supportive" ? color.success : p.tone === "testing" ? color.danger : color.warning;
          return (
            <View key={i} style={[s.timelineItem, { borderLeftColor: tc }]}>
              <View style={s.tlHeader}>
                <Text style={s.tlPeriod}>
                  {p.period}
                  {p.current ? (
                    <Text style={s.tlNow}>  NOW</Text>
                  ) : null}
                </Text>
                <Text style={[s.tlPhase, { color: tc, borderColor: tc + "55" }]}>{p.phase}</Text>
              </View>
              <Text style={s.tlDates}>{fmtDate(p.start)} – {fmtDate(p.end)}</Text>
              <Text style={s.tlSummary}>{p.summary}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                {p.areas.map((a, j) => (
                  <Text key={j} style={s.tlHouse}>H{a.house}</Text>
                ))}
              </View>
            </View>
          );
        })}
      </CosmicCard>

      <CosmicCard>
        <Text style={s.cardTitle}>Prediction Confidence</Text>
        <Text style={s.cardSub}>How many independent chart signatures back each theme.</Text>
        {chart.confidence.map((c, i) => {
          const lc = c.level === "High" ? color.success : c.level === "Moderate" ? color.warning : color.danger;
          return (
            <View key={i} style={{ marginBottom: 14 }}>
              <View style={s.confRow}>
                <Text style={s.confTheme}>{c.theme}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={s.confCount}>{c.count}/{c.total}</Text>
                  <Text style={[s.confLevel, { color: lc, borderColor: lc + "55" }]}>{c.level}</Text>
                </View>
              </View>
              {c.supporting.slice(0, 3).map((sp, j) => (
                <Text key={j} style={s.confSup}>✓ {sp}</Text>
              ))}
            </View>
          );
        })}
      </CosmicCard>

      <CosmicCard>
        <Text style={s.cardTitle}>Current Sky (Gochar)</Text>
        {chart.transits.sadeSati.active ? (
          <View style={s.sadeBad}>
            <Text style={{ color: color.danger, fontWeight: "700" }}>
              ⚠ Sade Sati Phase: {chart.transits.sadeSati.phase}
            </Text>
          </View>
        ) : (
          <View style={s.sadeGood}>
            <Text style={{ color: color.success, fontWeight: "600" }}>✓ Free from Sade Sati</Text>
          </View>
        )}
        {chart.transits.positions.map((p) => (
          <View key={p.name} style={s.transitRow}>
            <Text style={{ color: color.textDim, lineHeight: 22 }}>{p.name}</Text>
            <Text style={{ color: color.text, lineHeight: 22 }}>
              {ZE[p.sign]} {p.sign}{" "}
              <Text style={{ color: color.textMuted, fontSize: fontSize.xs }}>
                • {p.houseMoon}th from Moon
              </Text>
            </Text>
          </View>
        ))}
      </CosmicCard>
    </>
  );
}
