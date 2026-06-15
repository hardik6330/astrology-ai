import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import CosmicCard from "../../../components/CosmicCard";
import PlanetaryStrengthCard from "../../kundali/PlanetaryStrengthCard";
import { useColors } from "../../../theme/ThemeContext";
import { useStyles } from "../../../theme/useStyles";
import { signOf, ZE, fmtDate } from "../../../shared/astrology";
import { planetEnglish } from "../../../shared/planetText";
import { makeStyles } from "../styles";
import ProgressBar from "./ProgressBar";
import PlanetDetailSheet from "./PlanetDetailSheet";
import { planetInfoFor } from "../planetInfo";
import { haptics } from "../../../utils/haptics";

// Planets tab: strength meter, full planetary position table, and the
// current/upcoming dasha (planetary-timing) breakdown.
export default function PlanetsTab({ chart, now }) {
  const color = useColors();
  const s = useStyles(makeStyles);
  // Tapped planet → opens the detail bottom sheet. null = closed.
  const [selected, setSelected] = useState(null);

  return (
    <>
      {/* New: Planetary Strength meter */}
      <PlanetaryStrengthCard strengths={chart.strengths} />

      <CosmicCard>
        <Text style={s.cardTitle}>Planetary Positions</Text>
        <Text style={s.cardSub}>
          Whole-sign house system — tap any planet to learn what it means for you.
        </Text>
        <View style={s.tableHeader}>
          <Text style={[s.thCell, { flex: 1.2 }]}>PLANET</Text>
          <Text style={[s.thCell, { flex: 1.5 }]}>VEDIC</Text>
          <Text style={[s.thCell, { flex: 1.5 }]}>WESTERN</Text>
          <Text style={[s.thCell, { flex: 0.6, textAlign: "center" }]}>H</Text>
        </View>
        {chart.planets.map((p) => {
          const tappable = !!planetInfoFor(p);
          return (
            <Pressable
              key={p.name}
              onPress={() => { if (tappable) { haptics.tap(); setSelected(p); } }}
              disabled={!tappable}
              style={({ pressed }) => [s.tableRow, pressed && tappable && { backgroundColor: "rgba(168,85,247,0.08)", transform: [{ scale: 0.99 }] }]}
            >
              <Text style={[s.tdCell, { flex: 1.2, color: color.textBody }]} numberOfLines={1}>
                {p.name}{p.retro ? <Text style={{ color: color.danger }}>  ℞</Text> : ""}
                {tappable ? <Text style={{ color: color.primaryLight }}>  ›</Text> : ""}
              </Text>
              <Text style={[s.tdCell, { flex: 1.5 }]}>{ZE[signOf(p.sid)]} {signOf(p.sid)}</Text>
              <Text style={[s.tdCell, { flex: 1.5 }]}>{ZE[signOf(p.trop)]} {signOf(p.trop)}</Text>
              <Text style={[s.tdCell, { flex: 0.6, textAlign: "center", color: color.textMuted }]}>{p.houseSid}</Text>
            </Pressable>
          );
        })}
      </CosmicCard>

      <CosmicCard>
        <Text style={s.cardTitle}>Planetary Timing</Text>
        <View style={s.dashaCurrent}>
          <Text style={s.dashaTitle}>
            {planetEnglish(chart.curMaha.lord)} Major Period
            {chart.curAntar ? <Text style={{ color: color.primary }}> · {planetEnglish(chart.curAntar.lord)} Sub-Period</Text> : null}
          </Text>
          <Text style={s.dashaDates}>
            {fmtDate(chart.curMaha.start)} – {fmtDate(chart.curMaha.end)}
          </Text>
          <ProgressBar
            label={planetEnglish(chart.curMaha.lord)}
            s={+chart.curMaha.start} e={+chart.curMaha.end} now={now} col={color.accent}
          />
          {chart.curAntar && (
            <ProgressBar
              label={planetEnglish(chart.curAntar.lord)}
              s={+chart.curAntar.start} e={+chart.curAntar.end} now={now} col={color.primary}
            />
          )}
        </View>
        {chart.dasha.filter((m) => m.end > new Date()).slice(0, 5).map((m, i) => (
          <View key={i} style={s.dashaRow}>
            <Text style={[s.dashaRowLabel, m === chart.curMaha && { color: color.text, fontWeight: "700" }]}>
              {planetEnglish(m.lord)} Major Period
            </Text>
            <Text style={s.dashaRowDate}>{fmtDate(m.start)} – {fmtDate(m.end)}</Text>
          </View>
        ))}
      </CosmicCard>

      <PlanetDetailSheet planet={selected} onClose={() => setSelected(null)} />
    </>
  );
}
