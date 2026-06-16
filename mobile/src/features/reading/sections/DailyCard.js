import React, { useEffect, useRef } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import CosmicCard from "../../../components/CosmicCard";
import { useColors } from "../../../theme/ThemeContext";
import { useStyles } from "../../../theme/useStyles";
import { useCosts } from "../../../hooks/useCosts";
import { useCredits } from "../../../hooks/useCredits";
import { spacing } from "../../../theme/tokens";
import { WD_SHORT, MONTHS } from "../constants";
import { EMOJIS } from "../../../utils/emojis";
import { makeStyles } from "../styles";

export default function DailyCard({
  form, dailyTransit, guide, monthDays, selDate, todayIso, savedDates, selectDay, generateDaily, dailyBusy,
  dailyLowCredits, activeLoc, locError, getGpsLocation,
}) {
  const color = useColors();
  const s = useStyles(makeStyles);
  const costs = useCosts();
  const dailyCost = costs?.daily ?? 15;
  const credits = useCredits();
  // Can't afford a day's guidance — balance already too low, or a generate
  // attempt just came back 402. Drives the disabled button label.
  const cannotAfford = dailyLowCredits || (credits != null && credits < dailyCost);
  const stripRef = useRef(null);
  const DAY_W = 56; // 50px button + 6px gap

  // Center today's date when the strip first renders.
  useEffect(() => {
    const idx = monthDays.findIndex((d) => d.toISOString().split("T")[0] === todayIso);
    if (idx < 0) return;
    // Defer until after layout so the ScrollView has a measured width.
    const id = setTimeout(() => {
      stripRef.current?.scrollTo({ x: Math.max(0, idx * DAY_W - 120), animated: false });
    }, 50);
    return () => clearTimeout(id);
  }, [monthDays, todayIso]);

  if (!dailyTransit) return null;
  const dStr = (d) => d.toISOString().split("T")[0];
  return (
    <CosmicCard>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <Text style={[s.cardTitle, { marginBottom: 0 }]}>
          {(form.name || "Your")}{form.name ? "'s" : ""} Daily Insights
        </Text>

        <View style={{ textAlign: "right" }}>
          {activeLoc?.isGps ? (
            <Text style={{ fontSize: 11, lineHeight: 16, includeFontPadding: false, color: color.primaryLight, fontWeight: "500" }}>
              {EMOJIS.PIN} {activeLoc.n} (Live)
            </Text>
          ) : (
            <Pressable onPress={getGpsLocation}>
              <Text
                style={{
                  color: locError ? color.danger : color.primaryLight,
                  textDecorationLine: "underline",
                  fontSize: 11,
                  lineHeight: 16,
                  includeFontPadding: false,
                }}
              >
                {locError ? `${EMOJIS.WARNING} GPS Blocked` : `${EMOJIS.PIN} Use Live Location`}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView ref={stripRef} horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }} contentContainerStyle={{ gap: 6, paddingBottom: 4 }}>
        {monthDays.map((d) => {
          const id = dStr(d);
          const active  = id === dStr(selDate);
          const isToday = id === todayIso;
          const hasData = savedDates.has(id);
          return (
            <Pressable
              key={id}
              onPress={() => selectDay(d)}
              style={[s.dayBtn, active && s.dayBtnActive, !active && hasData && s.dayBtnHasData]}
            >
              <Text style={[s.dayBtnTop, active && { color: color.primaryLight }]}>
                {isToday ? "TODAY" : WD_SHORT[d.getDay()]}
              </Text>
              <Text style={[s.dayBtnNum, active && { color: color.primaryLight }]}>{d.getDate()}</Text>
              <Text style={s.dayBtnMo}>{MONTHS[d.getMonth()]}</Text>
              {hasData && <View style={s.dayDot} />}
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={s.alignPct}>{dailyTransit.alignment}% Aligned</Text>
      {guide?.dayTitle && <Text style={s.dayTitle}>{guide.dayTitle}</Text>}
      {guide?.intro && <Text style={s.dayIntro}>{guide.intro}</Text>}
      <Text style={s.dayMeta}>
        {dailyTransit.weekday} · ruled by {dailyTransit.dayLord} · Moon in {dailyTransit.moonSign}
      </Text>

      <View style={s.chipRow}>
        {[
          ["WEAR", dailyTransit.luckyColor],
          ["MANIFEST", "◆ " + dailyTransit.luckyNumber],
          ...(dailyTransit.auspicious ? [["AUSPICIOUS", `${dailyTransit.auspicious.start} – ${dailyTransit.auspicious.end}`]] : []),
          ...(dailyTransit.rahuKaal ? [["INAUSPICIOUS", `${dailyTransit.rahuKaal.start} – ${dailyTransit.rahuKaal.end}`]] : []),
        ].map(([l, v]) => (
          <View key={l} style={s.chip}>
            <Text style={[s.chipLabel, l === "INAUSPICIOUS" && { color: color.danger }]}>{l}</Text>
            <Text style={s.chipValue}>{v}</Text>
          </View>
        ))}
      </View>

      {guide?.action && (
        <View style={s.action}>
          <Text style={s.actionLabel}>ACTION OF THE DAY</Text>
          <Text style={s.actionText}>"{guide.action}"</Text>
        </View>
      )}

      {!guide && (
        <Pressable
          onPress={() => generateDaily(selDate)}
          disabled={dailyBusy || cannotAfford}
          style={[s.revealBtn, (dailyBusy || cannotAfford) && { opacity: 0.5 }]}
        >
          <Text style={s.revealText}>
            {dailyBusy
              ? "Reading the sky…"
              : cannotAfford
                ? `Not enough credits · ${dailyCost} needed`
                : `${EMOJIS.SPARKLES} Reveal ${MONTHS[selDate.getMonth()]} ${selDate.getDate()}'s Guidance · ${dailyCost} Credits`}
          </Text>
        </Pressable>
      )}

      {guide && (
        <View style={{ marginTop: spacing.md, gap: 10 }}>
          {[
            ["SELF", guide.self], ["LOVE", guide.love], ["RELATIONSHIP", guide.relationship],
            ["FAMILY", guide.family], ["JOB", guide.job], ["HEALTH", guide.health],
            ["WEALTH", guide.wealth], ["SPIRITUAL", guide.spiritual], ["AVOID", guide.avoid],
          ].map(([l, v]) => v ? (
            <View key={l}>
              <Text style={s.guideLabel}>{l}</Text>
              <Text style={s.guideText}>{v}</Text>
            </View>
          ) : null)}
        </View>
      )}
    </CosmicCard>
  );
}
