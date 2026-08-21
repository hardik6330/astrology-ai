import React, { useEffect } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";
import Animated, { useSharedValue, useAnimatedProps, withRepeat, withTiming, Easing } from "react-native-reanimated";
import CosmicCard from "../../components/CosmicCard";
import { useStyles } from "../../theme/useStyles";
import { useColors } from "../../theme/ThemeContext";
import { spacing, fontSize, radius } from "../../theme/tokens";
import { SIGNS, ZE, nm } from "../../shared/astrology";
import { haptics } from "../../utils/haptics";
import { STRINGS } from "../../shared/uiStrings";
import { useAuth } from "../auth/AuthContext";
import { useChartMemory } from "../../hooks/useChartMemory";

// Shared empty default — a fresh {} per render would break memoised comparisons.
const EMPTY_ASKED = {};

// Bi-Wheel Chart (Birth vs Live Sky). A sidereal zodiac wheel with TWO planet
// rings over the same signs:
//   • inner ring  = NATAL planets (chart.planets, by sidereal longitude) — small
//                   solid dots, fixed at birth.
//   • outer ring  = LIVE transits (chart.transits.gochar) — outlined glyphs with
//                   a pulsing halo, moving in the sky now.
// A dashed line connects a live planet to a birth planet when they're within ~7°
// (a transit conjunction — e.g. live Saturn over birth Moon = Sade Sati). Both
// datasets are already computed client-side, so this needs no API call.

const SIZE = 300;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_OUTER = 142;   // sign ring outer edge
const R_SIGN = 124;    // sign glyph radius
const R_TRANSIT = 110; // LIVE planet ring (outer)
const R_NATAL = 72;    // NATAL planet ring (inner)
const R_HUB = 44;      // inner hub edge (sign dividers stop here)
const CONJ_ORB = 7;    // degrees within which a transit "conjuncts" a natal planet

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

// Stagger glyphs that sit close together so they don't overlap: each is pushed
// toward the hub by how many earlier planets fall within 11° of it.
function stagger(list, baseR, step) {
  const sorted = [...list].sort((a, b) => a.lon - b.lon);
  return sorted.map((p, i) => {
    let crowd = 0;
    for (let j = 0; j < i; j++) {
      const d = Math.abs(sorted[j].lon - p.lon);
      if (Math.min(d, 360 - d) < 11) crowd++;
    }
    return { ...p, r: baseR - crowd * step };
  });
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function GocharMap({ chart, navigation }) {
  const styles = useStyles(makeStyles);
  const c = useColors();
  const { account } = useAuth();
  // Scope the asked-alignment state to the signed-in user so one account's
  // "Analyzed" rows don't leak to the next user on the same device. Server-owned
  // (see services/chartMemory.js) so it survives a reinstall.
  const storageKey = `asked_alignments:${account?.id ?? "anon"}`;
  const [askedRaw, setAsked] = useChartMemory(storageKey);
  const asked = askedRaw ?? EMPTY_ASKED;

  const markAsAsked = (key) => setAsked({ ...asked, [key]: true });

  // Pulsing halo on the live planets (hooks must run before any early return).
  const pulse = useSharedValue(0.16);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(0.42, { duration: 1300, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [pulse]);
  const haloProps = useAnimatedProps(() => ({ fillOpacity: pulse.value }));

  const gochar = chart?.transits?.gochar;
  if (!Array.isArray(gochar) || !gochar.length) return null;

  const ascLon = nm(chart.angles?.ascSid ?? 0);

  // Natal planets → {name, lon, retro}, only those we have a glyph for.
  const natalRaw = (chart.planets || [])
    .map((p) => ({ name: p.base || String(p.name || "").split(" ")[0], lon: nm(p.sid), retro: p.retro }))
    .filter((p) => GLYPH[p.name]);

  const liveP = stagger(gochar.map((p) => ({ ...p, lon: nm(p.lon) })), R_TRANSIT, 17);
  const natalP = stagger(natalRaw, R_NATAL, 14);

  // Transit↔natal conjunctions (within orb) → dashed connectors + a list.
  const conjunctions = [];
  liveP.forEach((t) => {
    natalP.forEach((n) => {
      let d = Math.abs(t.lon - n.lon);
      d = Math.min(d, 360 - d);
      if (d <= CONJ_ORB) conjunctions.push({ t, n, orb: Math.round(d) });
    });
  });

  return (
    <CosmicCard>
      <Text style={styles.title}>{STRINGS.CHART.TITLE}</Text>
      <Text style={styles.sub}>{STRINGS.CHART.SUBTITLE}</Text>

      <View style={{ alignItems: "center", marginTop: 6 }}>
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {/* Rings */}
          <Circle cx={CX} cy={CY} r={R_OUTER} stroke={c.cardBorder} strokeWidth={1.5} fill="none" />
          <Circle cx={CX} cy={CY} r={(R_TRANSIT + R_NATAL) / 2} stroke={c.cardBorder} strokeWidth={1.2} fill="none" opacity={0.8} />
          <Circle cx={CX} cy={CY} r={R_HUB} stroke={c.cardBorder} strokeWidth={1.5} fill="none" />

          {/* 12 sign sectors: dividers + glyphs */}
          {SIGNS.map((sign, i) => {
            const boundary = i * 30;
            const o = polar(boundary, R_OUTER);
            const inn = polar(boundary, R_HUB);
            const g = polar(i * 30 + 15, R_SIGN);
            const isLagnaSign = Math.floor(ascLon / 30) === i;
            return (
              <React.Fragment key={sign}>
                <Line x1={inn.x} y1={inn.y} x2={o.x} y2={o.y} stroke={c.cardBorder} strokeWidth={1.5} />
                {/* ZE glyphs render as colored emoji; opacity is the only dimmer.
                    Keep the rising/lagna sign brighter so it still stands out. */}
                <SvgText
                  x={g.x} y={g.y + 6} fontSize="20" textAnchor="middle"
                  fill={isLagnaSign ? c.primaryLight : c.textMain}
                  fontWeight="900"
                  opacity={isLagnaSign ? 0.85 : 0.4}
                >
                  {ZE[sign]}
                </SvgText>
              </React.Fragment>
            );
          })}

          {/* Conjunction connectors (drawn under the glyphs). */}
          {conjunctions.map(({ t, n }, i) => {
            const a = polar(n.lon, n.r);
            const b = polar(t.lon, t.r);
            return (
              <Line key={`c-${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={c.warning} strokeWidth={1.2} strokeDasharray="3,3" opacity={0.8} />
            );
          })}

          {/* Natal lagna (ascendant) marker — a tick + ASC label at the rim. */}
          {(() => {
            const tip = polar(ascLon, R_OUTER + 7);
            const base = polar(ascLon, R_OUTER - 6);
            const lbl = polar(ascLon, R_OUTER + 18);
            return (
              <>
                <Line x1={base.x} y1={base.y} x2={tip.x} y2={tip.y} stroke={c.primaryLight} strokeWidth={2.5} />
                <SvgText x={lbl.x} y={lbl.y + 4} fontSize="9" fontWeight="700" fill={c.primaryLight} textAnchor="middle">ASC</SvgText>
              </>
            );
          })()}

          {/* NATAL planets (inner) — small solid dots, fixed at birth. */}
          {natalP.map((p) => {
            const pt = polar(p.lon, p.r);
            const tint = MALEFIC.has(p.name) ? c.danger : c.success;
            return (
              <React.Fragment key={`n-${p.name}`}>
                <Circle cx={pt.x} cy={pt.y} r={8.5} fill={tint} opacity={0.92} />
                <SvgText x={pt.x} y={pt.y + 3.5} fontSize="10" fontWeight="800" fill="#0b0a1f" textAnchor="middle">
                  {GLYPH[p.name] || p.name[0]}
                </SvgText>
              </React.Fragment>
            );
          })}

          {/* LIVE transits (outer) — pulsing halo + outlined glyph. */}
          {liveP.map((p) => {
            const pt = polar(p.lon, p.r);
            const tint = MALEFIC.has(p.name) ? c.danger : c.success;
            return (
              <React.Fragment key={`t-${p.name}`}>
                <AnimatedCircle cx={pt.x} cy={pt.y} r={16} fill={tint} animatedProps={haloProps} />
                <Circle cx={pt.x} cy={pt.y} r={11} fill={c.bg} stroke={tint} strokeWidth={1.5} />
                <SvgText x={pt.x} y={pt.y + 5} fontSize="13" fontWeight="700" fill={tint} textAnchor="middle">
                  {GLYPH[p.name] || p.name[0]}
                </SvgText>
              </React.Fragment>
            );
          })}

          {/* Hub label */}
          <SvgText x={CX} y={CY - 4} fontSize="9" fill={c.textMuted} textAnchor="middle">{STRINGS.CHART.RISING}</SvgText>
          <SvgText x={CX} y={CY + 11} fontSize="12" fontWeight="700" fill={c.text} textAnchor="middle">
            {chart.transits.ascSign || ""}
          </SvgText>
        </Svg>
      </View>

      {/* Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}><View style={[styles.dotSolid, { backgroundColor: c.textBody }]} /><Text style={styles.legendLabel}>{STRINGS.CHART.NATAL_LABEL} (inner)</Text></View>
        <View style={styles.legendItem}><View style={[styles.dotRing, { borderColor: c.textBody }]} /><Text style={styles.legendLabel}>{STRINGS.CHART.TRANSIT_LABEL} (outer)</Text></View>
        <View style={styles.legendItem}><View style={[styles.dash, { backgroundColor: c.warning }]} /><Text style={styles.legendLabel}>Alignment</Text></View>
      </View>

      {/* Active alignments — the "wow" payoff: transit-over-natal conjunctions. */}
      {conjunctions.length > 0 && (
        <View style={styles.conjWrap}>
          <Text style={styles.conjTitle}>{STRINGS.CHART.CONJUNCTION_TITLE}</Text>
          {conjunctions.map(({ t, n, orb }, i) => {
            const key = `${t.name}-${n.name}`;
            const isAsked = asked[key];

            // One-tap deep link → chat auto-asks this exact alignment.
            const question =
              `Right now transiting ${t.name} is conjunct my natal ${n.name} ` +
              `(within ${orb}°). What does this alignment mean for me, and what should I focus on?`;
            const askChat = () => {
              if (isAsked) return;
              haptics.tap();
              markAsAsked(key);
              navigation?.navigate("Chat", { ask: question });
            };
            return (
              <View key={i} style={styles.conjItem}>
                <Text style={styles.conjRow}>
                  <Text style={{ color: c.warning, fontWeight: "800" }}>{GLYPH[t.name]} {STRINGS.CHART.TRANSIT_LABEL}ing {t.name}</Text>
                  {"  ≈  "}
                  <Text style={{ color: c.textBody, fontWeight: "700" }}>{GLYPH[n.name]} {STRINGS.CHART.NATAL_LABEL} {n.name}</Text>
                  <Text style={styles.conjOrb}>  · {orb}° orb</Text>
                </Text>
                {navigation && (
                  <Pressable
                    onPress={askChat}
                    hitSlop={6}
                    disabled={isAsked}
                    style={({ pressed }) => [
                      styles.askBtn,
                      isAsked && { borderColor: c.textMuted, backgroundColor: "rgba(255,255,255,0.04)", opacity: 0.6 },
                      pressed && !isAsked && { opacity: 0.75 }
                    ]}
                  >
                    <Text style={[styles.askBtnText, isAsked && { color: c.textMuted }]}>
                      {isAsked ? STRINGS.ACTIONS.ANALYZED : STRINGS.ACTIONS.INTERPRET + " ›"}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })}
          <Text style={styles.conjFoot}>{STRINGS.CHART.CONJUNCTION_FOOTNOTE}</Text>
        </View>
      )}

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
        <Text style={styles.impFoot}>House counted from your {STRINGS.CHART.ASCENDANT.toLowerCase()} ({chart.transits.ascSign}).</Text>
      </View>
    </CosmicCard>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    title: { color: c.text, fontSize: fontSize.md, lineHeight: 22, fontWeight: "700", marginBottom: 4 },
    sub:   { color: c.textMuted, fontSize: 11, marginBottom: spacing.md, lineHeight: 16 },

    legendRow:   { flexDirection: "row", justifyContent: "center", gap: spacing.lg, marginTop: spacing.md, flexWrap: "wrap" },
    legendItem:  { flexDirection: "row", alignItems: "center", gap: 6 },
    dotSolid:    { width: 10, height: 10, borderRadius: 5 },
    dotRing:     { width: 11, height: 11, borderRadius: 6, borderWidth: 2, backgroundColor: "transparent" },
    dash:        { width: 14, height: 2 },
    legendLabel: { color: c.textBody, fontSize: 11.5, fontWeight: "600" },

    conjWrap:    { marginTop: spacing.md, borderWidth: 1, borderColor: "rgba(251,191,36,0.25)", backgroundColor: "rgba(251,191,36,0.06)", borderRadius: 12, padding: 12, gap: 5 },
    conjTitle:   { color: c.warning, fontSize: 12, fontWeight: "800", letterSpacing: 0.5, marginBottom: 2 },
    conjItem:    { flexDirection: "row", alignItems: "center", gap: 8 },
    conjRow:     { flex: 1, fontSize: 12.5, lineHeight: 19, includeFontPadding: false },
    conjOrb:     { color: c.textMuted, fontSize: 11 },
    askBtn:      { borderWidth: 1, borderColor: c.warning, backgroundColor: "rgba(251,191,36,0.14)", borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 4 },
    askBtnText:  { color: c.warning, fontSize: 11.5, fontWeight: "800" },
    conjFoot:    { color: c.textMuted, fontSize: 10.5, lineHeight: 15, marginTop: 3 },

    impactWrap:  { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: c.cardBorder, paddingTop: spacing.md, gap: 7 },
    impactRow:   { flexDirection: "row", alignItems: "center", gap: 8 },
    impGlyph:    { width: 16, fontSize: 14, fontWeight: "700", textAlign: "center" },
    impName:     { width: 64, color: c.textBody, fontSize: 12.5, fontWeight: "600" },
    impSign:     { flex: 1, color: c.text, fontSize: 12.5, lineHeight: 18, includeFontPadding: false },
    impHouse:    { color: c.textMuted, fontSize: 11, fontWeight: "700", backgroundColor: c.inputBg, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2, overflow: "hidden" },
    impFoot:     { color: c.textMuted, fontSize: 10.5, lineHeight: 15, marginTop: 4 },
  });
