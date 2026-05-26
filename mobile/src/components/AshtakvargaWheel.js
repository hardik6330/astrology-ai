import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Path, G, Text as SvgText, Circle } from "react-native-svg";
import CosmicCard from "./CosmicCard";
import { useStyles } from "../theme/useStyles";
import { useColors } from "../theme/ThemeContext";
import { radius, spacing, fontSize } from "../theme/tokens";

const SIZE = 280;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_OUTER = 130;
const R_INNER = 50;

function polar(angle, radius) {
  const r = (angle - 90) * Math.PI / 180;
  return { x: CX + radius * Math.cos(r), y: CY + radius * Math.sin(r) };
}

function sectorPath(start, end, rOuter, rInner) {
  const s1 = polar(start, rOuter);
  const e1 = polar(end,   rOuter);
  const s2 = polar(end,   rInner);
  const e2 = polar(start, rInner);
  return [
    `M ${s1.x} ${s1.y}`,
    `A ${rOuter} ${rOuter} 0 0 1 ${e1.x} ${e1.y}`,
    `L ${s2.x} ${s2.y}`,
    `A ${rInner} ${rInner} 0 0 0 ${e2.x} ${e2.y}`,
    "Z",
  ].join(" ");
}

// 0 (low) → 56 (max possible). 28 is "lucky" threshold.
function fillFor(total, c) {
  if (total >= 32) return c.success;
  if (total >= 28) return c.primaryLight;
  if (total >= 22) return c.warning;
  return c.danger;
}

export default function AshtakvargaWheel({ ashtakvarga }) {
  const styles = useStyles(makeStyles);
  const c = useColors();
  if (!ashtakvarga?.perSign) return null;

  const slice = 360 / 12;
  const totalSum = ashtakvarga.sarva.reduce((a, b) => a + b, 0);
  const luckyCount = ashtakvarga.perSign.filter((s) => s.lucky).length;

  return (
    <CosmicCard>
      <Text style={styles.title}>Ashtakvarga (Sarva)</Text>
      <Text style={styles.sub}>
        Total Bindus per sign · max 56 · 28+ counts as fortunate ({luckyCount}/12 lucky · sum {totalSum})
      </Text>

      <View style={{ alignItems: "center", marginTop: 6 }}>
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {ashtakvarga.perSign.map((s, i) => {
            const start = i * slice;
            const end   = (i + 1) * slice;
            // Outer radius scales with bindu count (16..56 → R_INNER+20..R_OUTER).
            const norm = Math.max(0, Math.min(1, (s.total - 16) / 40));
            const rOut = R_INNER + 22 + norm * (R_OUTER - R_INNER - 22);
            const mid  = polar((start + end) / 2, rOut + 10);
            return (
              <G key={s.sign}>
                <Path d={sectorPath(start, end, rOut, R_INNER)} fill={fillFor(s.total, c)} opacity={0.75} stroke={c.bg} strokeWidth={1} />
                <SvgText x={mid.x} y={mid.y + 3} fontSize="9" fill={c.textBody} textAnchor="middle">
                  {s.sign.slice(0, 3)}
                </SvgText>
                <SvgText
                  x={polar((start + end) / 2, R_INNER + (rOut - R_INNER) / 2).x}
                  y={polar((start + end) / 2, R_INNER + (rOut - R_INNER) / 2).y + 3}
                  fontSize="11" fontWeight="700" fill="#fff" textAnchor="middle"
                >
                  {s.total}
                </SvgText>
              </G>
            );
          })}
          <Circle cx={CX} cy={CY} r={R_INNER} fill={c.cardBgSolid} stroke={c.cardBorder} />
          <SvgText x={CX} y={CY - 4} fontSize="10" fill={c.textMuted} textAnchor="middle">SARVA</SvgText>
          <SvgText x={CX} y={CY + 12} fontSize="14" fontWeight="700" fill={c.text} textAnchor="middle">{totalSum}/337</SvgText>
        </Svg>
      </View>

      <View style={styles.legendRow}>
        {[
          ["32+ Excellent", c.success],
          ["28–31 Lucky",   c.primaryLight],
          ["22–27 Mixed",   c.warning],
          ["≤21 Weak",      c.danger],
        ].map(([label, color]) => (
          <View key={label} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: color }]} />
            <Text style={styles.legendLabel}>{label}</Text>
          </View>
        ))}
      </View>
    </CosmicCard>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    title: { color: c.text, fontSize: fontSize.md, lineHeight: 22, fontWeight: "700", marginBottom: 4 },
    sub:   { color: c.textMuted, fontSize: 11, marginBottom: spacing.md },

    legendRow:   { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing.sm, marginTop: spacing.md },
    legendItem:  { flexDirection: "row", alignItems: "center", gap: 5 },
    swatch:      { width: 10, height: 10, borderRadius: radius.pill },
    legendLabel: { color: c.textBody, fontSize: 10.5 },
  });
