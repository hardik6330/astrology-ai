import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle, Path, G, Text as SvgText } from "react-native-svg";
import CosmicCard from "../../components/CosmicCard";
import { useStyles } from "../../theme/useStyles";
import { useColors } from "../../theme/ThemeContext";
import { radius, spacing, fontSize } from "../../theme/tokens";
import { fmtDate } from "../../shared/astrology";

const SIZE   = 240;
const CX = SIZE / 2;
const CY = SIZE / 2;
const RING_OUTER = 110;
const RING_INNER =  72;
const ARC_INNER  =  62;

function polar(angle, radius) {
  const r = (angle - 90) * Math.PI / 180;
  return { x: CX + radius * Math.cos(r), y: CY + radius * Math.sin(r) };
}

function arcPath(start, end, rOuter, rInner) {
  const s1 = polar(start, rOuter);
  const e1 = polar(end,   rOuter);
  const s2 = polar(end,   rInner);
  const e2 = polar(start, rInner);
  const large = end - start > 180 ? 1 : 0;
  return [
    `M ${s1.x} ${s1.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${e1.x} ${e1.y}`,
    `L ${s2.x} ${s2.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${e2.x} ${e2.y}`,
    "Z",
  ].join(" ");
}

export default function DashaWheel({ chart }) {
  const styles = useStyles(makeStyles);
  const c = useColors();
  if (!chart?.curMaha) return null;

  const maha = chart.curMaha;
  const antar = chart.curAntar;
  const now = Date.now();

  // Mahadasha sweep (outer ring) — % complete.
  const mahaPct = Math.max(0, Math.min(100, ((now - +maha.start) / (+maha.end - +maha.start)) * 100));
  // Antardasha sweep (inner ring).
  const antarPct = antar ? Math.max(0, Math.min(100, ((now - +antar.start) / (+antar.end - +antar.start)) * 100)) : 0;

  const mahaArc  = arcPath(0, (mahaPct  / 100) * 360, RING_OUTER, RING_INNER);
  const antarArc = arcPath(0, (antarPct / 100) * 360, RING_INNER, ARC_INNER);

  return (
    <CosmicCard>
      <Text style={styles.title}>Dasha Timeline Wheel</Text>
      <Text style={styles.sub}>Outer ring = Mahadasha. Inner ring = Antardasha.</Text>

      <View style={{ alignItems: "center", marginTop: 6 }}>
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {/* Track rings */}
          <Circle cx={CX} cy={CY} r={(RING_OUTER + RING_INNER) / 2} stroke={c.cardBorder} strokeWidth={RING_OUTER - RING_INNER} fill="none" />
          <Circle cx={CX} cy={CY} r={(RING_INNER + ARC_INNER) / 2}   stroke={c.cardBorder} strokeWidth={RING_INNER - ARC_INNER} fill="none" />

          {/* Filled sweeps */}
          <Path d={mahaArc}  fill={c.primary} opacity={0.85} />
          <Path d={antarArc} fill={c.accent}  opacity={0.85} />

          {/* Center text */}
          <SvgText x={CX} y={CY - 8} fontSize="11" fill={c.textMuted} textAnchor="middle">CURRENT</SvgText>
          <SvgText x={CX} y={CY + 10} fontSize="18" fontWeight="700" fill={c.text} textAnchor="middle">{maha.lord}</SvgText>
          {antar && (
            <SvgText x={CX} y={CY + 28} fontSize="11" fill={c.primaryLight} textAnchor="middle">/ {antar.lord}</SvgText>
          )}
        </Svg>
      </View>

      {/* Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: c.primary }]} />
          <Text style={styles.legendLabel}>Mahadasha · {Math.round(mahaPct)}%</Text>
        </View>
        {antar && (
          <View style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: c.accent }]} />
            <Text style={styles.legendLabel}>Antardasha · {Math.round(antarPct)}%</Text>
          </View>
        )}
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          {fmtDate(maha.start)} – {fmtDate(maha.end)}
        </Text>
        {antar && (
          <Text style={styles.metaText}>
            Antar: {fmtDate(antar.start)} – {fmtDate(antar.end)}
          </Text>
        )}
      </View>
    </CosmicCard>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    title: { color: c.text, fontSize: fontSize.md, lineHeight: 22, fontWeight: "700", marginBottom: 4 },
    sub:   { color: c.textMuted, fontSize: 11, marginBottom: spacing.md },

    legendRow:   { flexDirection: "row", justifyContent: "center", gap: spacing.lg, marginTop: spacing.md },
    legendItem:  { flexDirection: "row", alignItems: "center", gap: 6 },
    swatch:      { width: 12, height: 12, borderRadius: radius.pill },
    legendLabel: { color: c.textBody, fontSize: 11.5, fontWeight: "600" },

    metaRow:  { marginTop: spacing.md, alignItems: "center", gap: 2 },
    metaText: { color: c.textMuted, fontSize: 11 },
  });
