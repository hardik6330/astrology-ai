import React, { useState } from "react";
import { View, Text, Pressable, LayoutAnimation, Platform, UIManager } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import CosmicCard from "../../../components/CosmicCard";
import DashaWheel from "../../kundali/DashaWheel";
import AshtakvargaWheel from "../../kundali/AshtakvargaWheel";
import GocharMap from "../../kundali/GocharMap";
import { useColors } from "../../../theme/ThemeContext";
import { useStyles } from "../../../theme/useStyles";
import { fontSize } from "../../../theme/tokens";
import { ZE, fmtDate } from "../../../shared/astrology";
import { periodEnglish } from "../../../shared/planetText";
import { EMOJIS } from "../../../utils/emojis";
import { makeStyles } from "../styles";
import { dashaGuidanceFor } from "../planetInfo";
import { haptics } from "../../../utils/haptics";

// Android needs this flag for LayoutAnimation to animate the expand.
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// One forecast window — tap to expand the reasoning (why) + behavioral
// Do's / Don'ts for that dasha lord. Guidance is static per planet (free).
function ForecastItem({ p, tc, s, color }) {
  const [open, setOpen] = useState(false);
  const guide = dashaGuidanceFor(p.period);
  const why = Array.isArray(p.why) ? p.why : [];
  const expandable = why.length > 0 || !!guide;

  function toggle() {
    haptics.select();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  }

  return (
    <Pressable
      onPress={expandable ? toggle : undefined}
      style={({ pressed }) => [s.timelineItem, { borderLeftColor: tc }, pressed && expandable && { opacity: 0.85 }]}
    >
      <View style={s.tlHeader}>
        <Text style={s.tlPeriod}>
          {periodEnglish(p.period)}
          {p.current ? <Text style={s.tlNow}>  NOW</Text> : null}
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

      {expandable && (
        <Text style={[s.tlToggle, { color: tc }]}>{open ? "Hide details ▲" : "Tap for Do's & Don'ts ▼"}</Text>
      )}

      {open && (
        <Animated.View entering={FadeIn.duration(220)} style={s.tlDetail}>
          {why.length > 0 && (
            <>
              <Text style={s.tlDetailLabel}>WHY THIS PERIOD</Text>
              {why.map((w, k) => (
                <Text key={k} style={s.tlWhy}>{EMOJIS.SPARKLES} {w}</Text>
              ))}
            </>
          )}
          {guide && (
            <View style={s.tlGuideSplit}>
              <View style={[s.tlGuideCol, { borderColor: "rgba(34,197,94,0.25)", backgroundColor: "rgba(34,197,94,0.06)" }]}>
                <Text style={[s.tlGuideTitle, { color: color.success }]}>{EMOJIS.CHECK} Do</Text>
                {guide.dos.map((d, k) => <Text key={k} style={s.tlGuideItem}>• {d}</Text>)}
              </View>
              <View style={[s.tlGuideCol, { borderColor: "rgba(248,113,113,0.25)", backgroundColor: "rgba(248,113,113,0.06)" }]}>
                <Text style={[s.tlGuideTitle, { color: color.danger }]}>{"✕ Don't"}</Text>
                {guide.donts.map((d, k) => <Text key={k} style={s.tlGuideItem}>• {d}</Text>)}
              </View>
            </View>
          )}
        </Animated.View>
      )}
    </Pressable>
  );
}

// Timeline tab: dasha + ashtakvarga wheels, the dasha-window forecast,
// prediction-confidence breakdown, and the current sky (gochar) transits.
export default function TimelineTab({ chart, navigation }) {
  const color = useColors();
  const s = useStyles(makeStyles);

  return (
    <>
      {/* New: Dasha Timeline Wheel */}
      <DashaWheel chart={chart} />

      {/* New: Ashtakvarga Wheel */}
      <AshtakvargaWheel ashtakvarga={chart.ashtakvarga} />

      {/* New: Live Transit (Gochar) Map — real-time sky over the natal chart */}
      <GocharMap chart={chart} navigation={navigation} />

      <CosmicCard>
        <Text style={s.cardTitle}>Timeline Forecast</Text>
        <Text style={s.cardSub}>{"Upcoming period windows — tap one for its Do's & Don'ts."}</Text>
        {chart.predictions.map((p, i) => {
          const tc = p.tone === "supportive" ? color.success : p.tone === "testing" ? color.danger : color.warning;
          return <ForecastItem key={i} p={p} tc={tc} s={s} color={color} />;
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
                <Text key={j} style={s.confSup}>{EMOJIS.CHECK} {sp}</Text>
              ))}
            </View>
          );
        })}
      </CosmicCard>

      <CosmicCard>
        <Text style={s.cardTitle}>Current Sky (Transits)</Text>
        {chart.transits.sadeSati.active ? (
          <View style={s.sadeBad}>
            <Text style={{ color: color.danger, fontWeight: "700" }}>
              ⚠ Saturn Cycle Phase: {chart.transits.sadeSati.phase}
            </Text>
          </View>
        ) : (
          <View style={s.sadeGood}>
            <Text style={{ color: color.success, fontWeight: "600" }}>{EMOJIS.CHECK} Free from Saturn Cycle</Text>
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
