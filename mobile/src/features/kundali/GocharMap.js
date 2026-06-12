import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";
import CosmicCard from "../../components/CosmicCard";
import { useStyles } from "../../theme/useStyles";
import { useColors } from "../../theme/ThemeContext";
import { spacing, fontSize } from "../../theme/tokens";
import { SIGNS, ZE } from "../../shared/astrology";

// Live Transit (Gochar) Map — a sidereal zodiac wheel showing where every graha
// is in the sky RIGHT NOW (chart.transits.gochar), with the natal lagna marked
// so the user sees the transit landing on their own chart. Below the wheel, an
// impact list maps each planet to the house it transits from the lagna.

const SIZE = 300;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_OUTER = 142;   // sign ring outer edge
const R_SIGN = 124;    // sign glyph radius
const R_INNER = 84;    // inner hub edge (sign dividers stop here)
const R_PLANET = 108;  // base planet-glyph radius
const R_LAGNA = R_OUTER; // lagna tick reaches the rim

// Single-char astro glyphs render crisper in SVG than the emoji set.
const GLYPH = {
  Sun: "☉", Moon: "☾", Mars: "♂", Mercury: "☿", Jupiter: "♃",
  Venus: "♀", Saturn: "♄", Rahu: "☊", Ketu: "☋",
};
// Classical benefic / malefic → glyph tint (purely visual cue).
const MALEFIC = new Set(["Sun", "Mars", "Saturn", "Rahu", "Ketu"]);

// Longitude (0°=Aries) → screen point. -90 puts 0° at the top; angles increase
// clockwise like a standard chart.
function polar(lon, r) {
  const a = (lon - 90) * Math.PI / 180;
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
}

export default function GocharMap({ chart }) {
  const styles = useStyles(makeStyles);
  const c = useColors();
  const gochar = chart?.transits?.gochar;
  if (!Array.isArray(gochar) || !gochar.length) return null;

  const ascLon = chart.angles?.ascSid ?? 0;

  // Stagger planets that sit close together so glyphs don't overlap: each planet
  // is pushed inward by how many earlier planets fall within 11° of it.
  const sorted = [...gochar].sort((a, b) => a.lon - b.lon);
  const placed = sorted.map((p, i) => {
    let crowd = 0;
    for (let j = 0; j < i; j++) {
      const d = Math.abs(sorted[j].lon - p.lon);
      if (Math.min(d, 360 - d) < 11) crowd++;
    }
    return { ...p, r: R_PLANET - crowd * 17 };
  });

  return (
    <CosmicCard>
      <Text style={styles.title}>Live Transit Map (Gochar)</Text>
      <Text style={styles.sub}>Where the planets sit in the sky right now, over your birth chart.</Text>

      <View style={{ alignItems: "center", marginTop: 6 }}>
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {/* Rings */}
          <Circle cx={CX} cy={CY} r={R_OUTER} stroke={c.cardBorder} strokeWidth={1} fill="none" />
          <Circle cx={CX} cy={CY} r={R_INNER} stroke={c.cardBorder} strokeWidth={1} fill="none" />

          {/* 12 sign sectors: dividers + glyphs */}
          {SIGNS.map((sign, i) => {
            const boundary = i * 30;
            const o = polar(boundary, R_OUTER);
            const inn = polar(boundary, R_INNER);
            const g = polar(i * 30 + 15, R_SIGN);
            const isLagnaSign = Math.floor((ascLon % 360) / 30) === i;
            return (
              <React.Fragment key={sign}>
                <Line x1={inn.x} y1={inn.y} x2={o.x} y2={o.y} stroke={c.cardBorder} strokeWidth={1} />
                <SvgText
                  x={g.x} y={g.y + 5} fontSize="15" textAnchor="middle"
                  fill={isLagnaSign ? c.primaryLight : c.textMuted}
                  fontWeight={isLagnaSign ? "700" : "400"}
                >
                  {ZE[sign]}
                </SvgText>
              </React.Fragment>
            );
          })}

          {/* Natal lagna (ascendant) marker — a tick + ASC label at the rim. */}
          {(() => {
            const tip = polar(ascLon, R_LAGNA + 7);
            const base = polar(ascLon, R_OUTER - 6);
            const lbl = polar(ascLon, R_LAGNA + 18);
            return (
              <>
                <Line x1={base.x} y1={base.y} x2={tip.x} y2={tip.y} stroke={c.primaryLight} strokeWidth={2.5} />
                <SvgText x={lbl.x} y={lbl.y + 4} fontSize="9" fontWeight="700" fill={c.primaryLight} textAnchor="middle">ASC</SvgText>
              </>
            );
          })()}

          {/* Transiting planets */}
          {placed.map((p) => {
            const pt = polar(p.lon, p.r);
            const tint = MALEFIC.has(p.name) ? c.danger : c.success;
            return (
              <React.Fragment key={p.name}>
                <Circle cx={pt.x} cy={pt.y} r={11} fill={c.bg} stroke={tint} strokeWidth={1.5} opacity={0.95} />
                <SvgText x={pt.x} y={pt.y + 5} fontSize="13" fontWeight="700" fill={tint} textAnchor="middle">
                  {GLYPH[p.name] || p.name[0]}
                </SvgText>
              </React.Fragment>
            );
          })}

          {/* Hub label */}
          <SvgText x={CX} y={CY - 6} fontSize="10" fill={c.textMuted} textAnchor="middle">LIVE SKY</SvgText>
          <SvgText x={CX} y={CY + 12} fontSize="12" fontWeight="700" fill={c.text} textAnchor="middle">
            {chart.transits.ascSign || ""} rising
          </SvgText>
        </Svg>
      </View>

      {/* Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: c.success }]} /><Text style={styles.legendLabel}>Benefic</Text></View>
        <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: c.danger }]} /><Text style={styles.legendLabel}>Malefic</Text></View>
        <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: c.primaryLight }]} /><Text style={styles.legendLabel}>Your Lagna</Text></View>
      </View>

      {/* Impact list — each transit → the house it activates from your lagna. */}
      <View style={styles.impactWrap}>
        {gochar.map((p) => (
          <View key={p.name} style={styles.impactRow}>
            <Text style={[styles.impGlyph, { color: MALEFIC.has(p.name) ? c.danger : c.success }]}>{GLYPH[p.name] || ""}</Text>
            <Text style={styles.impName}>{p.name}{p.retro ? " ℞" : ""}</Text>
            <Text style={styles.impSign}>{ZE[p.sign]} {p.sign} {p.deg}°</Text>
            <Text style={styles.impHouse}>H{p.houseLagna}</Text>
          </View>
        ))}
        <Text style={styles.impFoot}>House counted from your ascendant ({chart.transits.ascSign}). Tap the Planets tab for what each planet means.</Text>
      </View>
    </CosmicCard>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    title: { color: c.text, fontSize: fontSize.md, lineHeight: 22, fontWeight: "700", marginBottom: 4 },
    sub:   { color: c.textMuted, fontSize: 11, marginBottom: spacing.md },

    legendRow:   { flexDirection: "row", justifyContent: "center", gap: spacing.lg, marginTop: spacing.md, flexWrap: "wrap" },
    legendItem:  { flexDirection: "row", alignItems: "center", gap: 6 },
    dot:         { width: 10, height: 10, borderRadius: 5 },
    legendLabel: { color: c.textBody, fontSize: 11.5, fontWeight: "600" },

    impactWrap:  { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: c.cardBorder, paddingTop: spacing.md, gap: 7 },
    impactRow:   { flexDirection: "row", alignItems: "center", gap: 8 },
    impGlyph:    { width: 16, fontSize: 14, fontWeight: "700", textAlign: "center" },
    impName:     { width: 64, color: c.textBody, fontSize: 12.5, fontWeight: "600" },
    impSign:     { flex: 1, color: c.text, fontSize: 12.5, lineHeight: 18, includeFontPadding: false },
    impHouse:    { color: c.textMuted, fontSize: 11, fontWeight: "700", backgroundColor: c.inputBg, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2, overflow: "hidden" },
    impFoot:     { color: c.textMuted, fontSize: 10.5, lineHeight: 15, marginTop: 4 },
  });
