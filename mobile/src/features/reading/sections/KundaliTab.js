import React from "react";
import { View, Text, Pressable } from "react-native";
import CosmicCard from "../../../components/CosmicCard";
import KundaliChart from "../../kundali/KundaliChart";
import DoshaCard from "../../kundali/DoshaCard";
import PanchangCard from "../../kundali/PanchangCard";
import { useColors } from "../../../theme/ThemeContext";
import { useStyles } from "../../../theme/useStyles";
import { radius, spacing } from "../../../theme/tokens";
import { signOf, ZE } from "../../../shared/astrology";
import { EMOJIS } from "../../../utils/emojis";
import { STRINGS } from "../../../shared/uiStrings";
import { makeStyles } from "../styles";
import DailyCard from "./DailyCard";

// Kundali tab: the Big Three + Nakshatra + daily insights, then the chart
// wheel, dosha/panchang snapshots, and the destiny-score matrix.
export default function KundaliTab({ chart, chartStyle, setChartStyle, daily }) {
  const color = useColors();
  const s = useStyles(makeStyles);

  const sunV  = signOf(chart.planets[0].sid);
  const moonV = signOf(chart.planets[1].sid);
  const ascV  = signOf(chart.angles.ascSid);

  return (
    <>
      <View style={s.row3}>
        {[[STRINGS.LABELS.SUN_SIGN, sunV, EMOJIS.SUN_FACE, null], [STRINGS.LABELS.MOON_SIGN, moonV, EMOJIS.MOON, null], [STRINGS.LABELS.ASCENDANT, ascV, EMOJIS.ARROW_UP, color.primaryLight]].map(([l, v, ic, tint]) => (
          <View key={l} style={s.bigThree}>
            <Text style={{ fontSize: 22, lineHeight: 30, marginBottom: 4, color: tint || undefined }}>{ic}</Text>
            <Text style={s.bigThreeLabel}>{l}</Text>
            <Text style={s.bigThreeGlyph}>{ZE[v] || ""}</Text>
            <Text style={s.bigThreeValue} numberOfLines={1} adjustsFontSizeToFit>{v}</Text>
          </View>
        ))}
      </View>

      <CosmicCard style={{ alignItems: "center", paddingVertical: spacing.md }}>
        <Text style={{ fontSize: 13, lineHeight: 20, color: color.warning, fontWeight: "500" }}>
          🌙 {STRINGS.LABELS.BIRTH_STAR}:{" "}
          <Text style={{ fontSize: 15, fontWeight: "700" }}>{chart.nakshatra}</Text>
        </Text>
      </CosmicCard>

      <DailyCard {...daily} />

      {/* Chart wheel */}
      <CosmicCard>
        <View style={s.chartHeader}>
          <Text style={s.cardTitle}>Celestial Wheel</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[["north", "North"], ["south", "South"]].map(([v, l]) => (
              <Pressable
                key={v}
                onPress={() => setChartStyle(v)}
                style={[s.styleBtn, chartStyle === v && s.styleBtnActive]}
              >
                <Text style={[s.styleBtnText, chartStyle === v && { color: color.accentLight }]}>{l}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <KundaliChart chart={chart} variant={chartStyle} />
        <Text style={s.legend}>
          Su:Sun • Mo:Moon • Ma:Mars • Me:Mercury • Ju:Jupiter • Ve:Venus • Sa:Saturn • Ra:Rahu • Ke:Ketu
        </Text>
      </CosmicCard>

      {/* New: Dosha & Yoga Status */}
      <DoshaCard doshas={chart.doshas} colors={color} />

      {/* New: Panchang Snapshot */}
      <PanchangCard panchang={chart.panchang} />

      {/* Destiny matrix */}
      <CosmicCard>
        <Text style={s.cardTitle}>Destiny Matrix</Text>
        {chart.scores.map((sc) => {
          const col = sc.score >= 70 ? color.success : sc.score >= 45 ? color.warning : color.danger;
          return (
            <View key={sc.key} style={{ marginBottom: 14 }}>
              <View style={s.scoreRow}>
                <Text style={s.scoreLabel}>{sc.key}</Text>
                <Text style={[s.scoreValue, { color: col }]}>
                  {sc.score}<Text style={s.scoreMax}>/100</Text>
                </Text>
              </View>
              <View style={s.barTrack}>
                <View style={{ width: `${sc.score}%`, height: "100%", backgroundColor: col, borderRadius: radius.pill }} />
              </View>
            </View>
          );
        })}
      </CosmicCard>
    </>
  );
}
