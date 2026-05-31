import React from "react";
import { View, Text } from "react-native";
import CosmicCard from "../../../components/CosmicCard";
import PlanetaryStrengthCard from "../../kundali/PlanetaryStrengthCard";
import { useColors } from "../../../theme/ThemeContext";
import { useStyles } from "../../../theme/useStyles";
import { signOf, ZE, fmtDate } from "../../../shared/astrology";
import { makeStyles } from "../styles";
import ProgressBar from "./ProgressBar";

// Planets tab: strength meter, full planetary position table, and the
// current/upcoming dasha (planetary-timing) breakdown.
export default function PlanetsTab({ chart, now }) {
  const color = useColors();
  const s = useStyles(makeStyles);

  return (
    <>
      {/* New: Planetary Strength meter */}
      <PlanetaryStrengthCard strengths={chart.strengths} />

      <CosmicCard>
        <Text style={s.cardTitle}>🪐 Planetary Positions</Text>
        <Text style={s.cardSub}>
          Whole-sign house system — each sign is one full house.
        </Text>
        <View style={s.tableHeader}>
          <Text style={[s.thCell, { flex: 1.2 }]}>PLANET</Text>
          <Text style={[s.thCell, { flex: 1.5 }]}>VEDIC</Text>
          <Text style={[s.thCell, { flex: 1.5 }]}>WESTERN</Text>
          <Text style={[s.thCell, { flex: 0.6, textAlign: "center" }]}>H</Text>
        </View>
        {chart.planets.map((p) => (
          <View key={p.name} style={s.tableRow}>
            <Text style={[s.tdCell, { flex: 1.2, color: color.textBody }]} numberOfLines={1}>
              {p.name}{p.retro ? <Text style={{ color: color.danger }}>  ℞</Text> : ""}
            </Text>
            <Text style={[s.tdCell, { flex: 1.5 }]}>{ZE[signOf(p.sid)]} {signOf(p.sid)}</Text>
            <Text style={[s.tdCell, { flex: 1.5 }]}>{ZE[signOf(p.trop)]} {signOf(p.trop)}</Text>
            <Text style={[s.tdCell, { flex: 0.6, textAlign: "center", color: color.textMuted }]}>{p.houseSid}</Text>
          </View>
        ))}
      </CosmicCard>

      <CosmicCard>
        <Text style={s.cardTitle}>Planetary Timing (Dasha)</Text>
        <View style={s.dashaCurrent}>
          <Text style={s.dashaTitle}>
            {chart.curMaha.lord} Mahadasha
            {chart.curAntar ? <Text style={{ color: color.primary }}> · {chart.curAntar.lord} Antardasha</Text> : null}
          </Text>
          <Text style={s.dashaDates}>
            {fmtDate(chart.curMaha.start)} – {fmtDate(chart.curMaha.end)}
          </Text>
          <ProgressBar
            label={chart.curMaha.lord}
            s={+chart.curMaha.start} e={+chart.curMaha.end} now={now} col={color.accent}
          />
          {chart.curAntar && (
            <ProgressBar
              label={chart.curAntar.lord}
              s={+chart.curAntar.start} e={+chart.curAntar.end} now={now} col={color.primary}
            />
          )}
        </View>
        {chart.dasha.filter((m) => m.end > new Date()).slice(0, 5).map((m, i) => (
          <View key={i} style={s.dashaRow}>
            <Text style={[s.dashaRowLabel, m === chart.curMaha && { color: color.text, fontWeight: "700" }]}>
              {m.lord} Mahadasha
            </Text>
            <Text style={s.dashaRowDate}>{fmtDate(m.start)} – {fmtDate(m.end)}</Text>
          </View>
        ))}
      </CosmicCard>
    </>
  );
}
