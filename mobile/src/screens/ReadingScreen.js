import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ScreenContainer from "../components/ScreenContainer";
import CosmicCard from "../components/CosmicCard";
import MagicButton from "../components/MagicButton";
import BottomNav from "../components/BottomNav";
import MenuButton from "../components/MenuButton";
import KundaliChart from "../components/KundaliChart";
import DoshaCard from "../components/DoshaCard";
import PanchangCard from "../components/PanchangCard";
import PlanetaryStrengthCard from "../components/PlanetaryStrengthCard";
import DashaWheel from "../components/DashaWheel";
import AshtakvargaWheel from "../components/AshtakvargaWheel";
import * as Location from "expo-location";
import { useChart } from "../context/ChartContext";
import { useColors } from "../theme/ThemeContext";
import { useStyles } from "../theme/useStyles";
import { radius, spacing, fontSize } from "../theme/tokens";
import {
  signOf, ZE, fmtDate, fmtDay, computeDaily, buildFactSheet,
} from "../shared/astrology";
import { MSGS } from "../shared/prompts";
import { chatCompletionJSON, fetchSaved, fetchDailyDates } from "../services/api";
import { SkeletonReading, SkeletonAIReading } from "../components/Skeleton";

// Coerce any LLM value into renderable text (some lite models return objects).
function asText(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(asText).join(" ");
  if (typeof v === "object") return Object.values(v).map(asText).join(" ");
  return String(v);
}

const WD_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const SUB_TABS = ["kundali", "planets", "timeline", "reading", "palm", "chat", "profile"];

const iso = (d) => d.toISOString().split("T")[0];

export default function ReadingScreen({ navigation, route }) {
  const { form, chart, interp, setInterp, currentLoc, setCurrentLoc } = useChart();
  const color = useColors();
  const s = useStyles(makeStyles);
  const [tab, setTab]             = useState(route.params?.tab || "kundali");
  const [chartStyle, setChartStyle] = useState("north");
  const [loading, setLoading]     = useState(false);
  const [loadMsg, setLoadMsg]     = useState("Reading your chart…");
  const [error, setError]         = useState("");
  const [overloaded, setOverloaded] = useState(false);
  const [cooldown, setCooldown]   = useState(0);
  const [dailyBusy, setDailyBusy] = useState(false);
  const [locError, setLocError]   = useState(false);
  const fetchedRef = useRef(false);
  const [now] = useState(() => Date.now());

  const getGpsLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocError(true);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const { latitude: lat, longitude: lon } = loc.coords;
      const tz = -(new Date().getTimezoneOffset() / 60);
      setCurrentLoc({ n: "Current Location", lat, lon, tz, isGps: true });
      setLocError(false);

      const [addr] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
      if (addr) {
        const city = addr.city || addr.district || addr.subregion || "Current Location";
        setCurrentLoc({ n: city, lat, lon, tz, isGps: true });
      }
    } catch (err) {
      setLocError(true);
    }
  };

  // City coords + tz now live on the form itself (no static-list lookup).
  const birthCity = useMemo(
    () => (form.lat != null && form.lon != null && form.tz != null
      ? { n: form.city, lat: form.lat, lon: form.lon, tz: form.tz }
      : null),
    [form.city, form.lat, form.lon, form.tz],
  );
  
  const activeLoc = currentLoc || birthCity;
  
  const todayIso = iso(new Date());

  const monthDays = useMemo(() => {
    const n = new Date();
    const y = n.getFullYear(), m = n.getMonth();
    const last = new Date(y, m + 1, 0).getDate();
    return Array.from({ length: last }, (_, i) => new Date(y, m, i + 1, 12, 0, 0, 0));
  }, []);

  const [selDate, setSelDate] = useState(() => new Date(new Date().setHours(12, 0, 0, 0)));
  const [guideMap, setGuideMap] = useState({});
  const [savedDates, setSavedDates] = useState(new Set());

  // Honor incoming tab param from BottomNav on other screens.
  useEffect(() => {
    if (route.params?.tab && SUB_TABS.includes(route.params.tab)) setTab(route.params.tab);
  }, [route.params?.tab]);

  useEffect(() => {
    fetchDailyDates(form).then((dates) => setSavedDates(new Set(dates)));
  }, [form]);

  const dailyTransit = useMemo(
    () => (chart && activeLoc ? computeDaily(chart, activeLoc, selDate) : null),
    [chart, activeLoc, selDate]
  );
  const guide = guideMap[iso(selDate)] || null;

  async function generateReading() {
    if (!chart) return;
    setError("");
    setOverloaded(false);
    setLoading(true);
    setLoadMsg(MSGS?.[0] || "Reading your chart…");
    let i = 0;
    const iv = setInterval(() => {
      i++;
      if (MSGS) setLoadMsg(MSGS[i % MSGS.length]);
    }, 2000);
    try {
      const saved = await fetchSaved("interpret", form);
      setInterp(
        saved ||
          (await chatCompletionJSON([], "interpret", {
            factSheet: buildFactSheet(chart, form),
            form,
          }))
      );
    } catch (e) {
      if (e.code === "AI_OVERLOADED") {
        setOverloaded(true);
        setCooldown(40);
      } else setError(e.message);
    } finally {
      clearInterval(iv);
      setLoading(false);
    }
  }

  // Auto-generate the AI reading whenever the chart changes (first load OR
  // after the user updates birth details). The ref is reset on chart change
  // so a fresh fetch fires; the guard still prevents duplicate calls within
  // the same chart instance.
  useEffect(() => {
    if (!chart) return;
    fetchedRef.current = false;
  }, [chart]);

  useEffect(() => {
    if (!chart || interp || fetchedRef.current) return;
    fetchedRef.current = true;
    generateReading();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart, interp]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function loadDaily(date) {
    const key = iso(date);
    if (dailyBusy || !chart || guideMap[key]) return;
    setDailyBusy(true);
    const d = computeDaily(chart, activeLoc, date);
    const ctx = `PERSON: ${form.name || "Unknown"} | GENDER: ${form.gender || "NOT SPECIFIED"}
NATAL: Lagna ${signOf(chart.angles.ascSid)}, Moon ${signOf(chart.planets[1].sid)}, Nakshatra ${chart.nakshatra}
DAY: ${d.weekday}, ${d.date.toDateString()} | Weekday ruling planet: ${d.dayLord}
Moon transits ${d.moonSign} — the ${d.moonHouseFromNatal}th house from the natal Moon
Day alignment score: ${d.alignment}% (higher = smoother day)
Running period: ${d.dasha}`;
    try {
      const saved = await fetchSaved("daily", form, key);
      const result = saved || (await chatCompletionJSON([], "daily", { ctx, form, date: key }));
      setGuideMap((m) => ({ ...m, [key]: result }));
      setSavedDates((s) => new Set(s).add(key));
    } catch (e) {
      setError("Daily guidance failed: " + e.message);
    }
    setDailyBusy(false);
  }

  function selectDay(date) {
    setSelDate(date);
    loadDaily(date);
  }

  if (!chart) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg }}>
        <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 95 }} showsVerticalScrollIndicator={false}>
            <SkeletonReading />
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  const sunV  = signOf(chart.planets[0].sid);
  const moonV = signOf(chart.planets[1].sid);
  const ascV  = signOf(chart.angles.ascSid);

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 95 }} showsVerticalScrollIndicator={false}>
          <View style={s.headerRow}>
            <MenuButton />
            <View style={s.headerTitleWrap}>
                <Text style={s.heroLabel} numberOfLines={1}>
                  {form.name || "Your"}'s Cosmic Blueprint
                </Text>
                <Text style={s.heroSub} numberOfLines={1}>
                  {form.date} • {form.time} • {form.city}
                </Text>
              </View>
            <View style={{ width: 40 }} />
          </View>

          {error ? (
            <CosmicCard error>
              <Text style={{ color: color.danger, fontSize: fontSize.sm }}>⚠️ {error}</Text>
            </CosmicCard>
          ) : null}

          {/* Common header: Big Three + Nakshatra + Daily (kundali tab only) */}
          {tab === "kundali" && (
            <>
              <View style={s.row3}>
                {[["Sun Sign", sunV, "☀️", null], ["Moon Sign", moonV, "🌙", null], ["Lagna", ascV, "⬆", color.primaryLight]].map(([l, v, ic, tint]) => (
                  <View key={l} style={s.bigThree}>
                    <Text style={{ fontSize: 22, lineHeight: 30, marginBottom: 4, color: tint || undefined }}>{ic}</Text>
                    <Text style={s.bigThreeLabel}>{l}</Text>
                    <Text style={s.bigThreeValue}>{ZE[v] || ""} {v}</Text>
                  </View>
                ))}
              </View>

              <CosmicCard style={{ alignItems: "center", paddingVertical: spacing.md }}>
                <Text style={{ fontSize: 13, lineHeight: 20, color: color.warning, fontWeight: "500" }}>
                  🌙 Janma Nakshatra:{" "}
                  <Text style={{ fontSize: 15, fontWeight: "700" }}>{chart.nakshatra}</Text>
                </Text>
              </CosmicCard>

              <DailyCard
                form={form} dailyTransit={dailyTransit} guide={guide}
                monthDays={monthDays} selDate={selDate} todayIso={todayIso}
                savedDates={savedDates} selectDay={selectDay}
                loadDaily={loadDaily} dailyBusy={dailyBusy}
                activeLoc={activeLoc} locError={locError} getGpsLocation={getGpsLocation}
              />
            </>
          )}

          {tab === "kundali" && (
            <>
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
          )}

          {tab === "planets" && (
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
          )}

          {tab === "timeline" && (
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
          )}

          {tab === "reading" && (
            <>
              {overloaded && !interp && (
                <CosmicCard style={s.aiBusyCard}>
                  <Text style={{ fontSize: 36, lineHeight: 48, textAlign: "center" }}>⏳</Text>
                  <Text style={s.aiBusyTitle}>AI is busy right now</Text>
                  <Text style={s.aiBusyBody}>
                    Our reader couldn't complete your reading after several tries.
                    {cooldown > 0 ? " Please wait a moment before trying again." : " You can try again now."}
                  </Text>
                  <MagicButton onPress={generateReading} disabled={cooldown > 0}>
                    {cooldown > 0 ? `🕒 Try Again in ${cooldown}s` : "🔄 Try Again"}
                  </MagicButton>
                </CosmicCard>
              )}

              {loading && !interp && (
                <>
                  <View style={{ alignItems: "center", marginBottom: spacing.md }}>
                    <Text style={{ fontSize: 32, lineHeight: 44 }}>🔮</Text>
                    <Text style={s.loadingTitle}>{loadMsg}</Text>
                    <Text style={s.loadingSub}>The stars are aligning for you…</Text>
                  </View>
                  <SkeletonAIReading />
                </>
              )}

              {interp && (
                <>
                  {/* ── Cosmic Blueprint hero ─────────────────────────── */}
                  <View style={s.blueprint}>
                    <Text style={s.blueprintLabel}>COSMIC BLUEPRINT</Text>
                    <View style={s.blueprintDivider} />
                    <Text style={s.blueprintText}>"{asText(interp.lifeTheme)}"</Text>
                    <Text style={s.blueprintFooter}>
                      Generated for {form.name || "you"} · {signOf(chart.angles.ascSid)} Lagna
                    </Text>
                  </View>

                  {/* ── Numbered narrative sections ───────────────────── */}
                  {[
                    { title: "Core Identity",      icon: "✨", body: asText(interp.bigThree),      accent: color.primaryLight },
                    { title: "Personality Matrix", icon: "👤", body: asText(interp.personality),   accent: color.accentLight },
                    { title: "Destiny & Purpose",  icon: "💼", body: asText(interp.career),        accent: color.warning },
                    { title: "Heart & Soul",       icon: "💛", body: asText(interp.relationships), accent: color.danger },
                  ].map((sec, i) =>
                    sec.body ? (
                      <View key={sec.title} style={[s.narrativeCard, { borderLeftColor: sec.accent }]}>
                        <View style={s.narrativeHead}>
                          <Text style={{ fontSize: 22, lineHeight: 30, marginRight: 10 }}>{sec.icon}</Text>
                          <Text style={s.narrativeTitle}>{sec.title}</Text>
                        </View>
                        <Text style={s.narrativeBody}>{sec.body}</Text>
                      </View>
                    ) : null
                  )}

                  {/* ── Strengths (full-width chip list) ──────────────── */}
                  {interp.strengths?.length > 0 && (
                    <View style={s.panelCard}>
                      <View style={s.panelHead}>
                        <View style={[s.panelDot, { backgroundColor: color.success }]} />
                        <Text style={[s.panelTitle, { color: color.success }]}>What's working for you</Text>
                      </View>
                      {interp.strengths.map((sp, i) => (
                        <View key={i} style={[s.chip, { backgroundColor: "rgba(34,197,94,0.06)", borderColor: "rgba(34,197,94,0.25)" }]}>
                          <Text style={[s.chipMark, { color: color.success }]}>✓</Text>
                          <Text style={s.chipText}>{asText(sp)}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* ── Growth zones ─────────────────────────────────── */}
                  {interp.challenges?.length > 0 && (
                    <View style={s.panelCard}>
                      <View style={s.panelHead}>
                        <View style={[s.panelDot, { backgroundColor: color.warning }]} />
                        <Text style={[s.panelTitle, { color: color.warning }]}>Where you'll grow</Text>
                      </View>
                      {interp.challenges.map((cg, i) => (
                        <View key={i} style={[s.chip, { backgroundColor: "rgba(251,191,36,0.06)", borderColor: "rgba(251,191,36,0.25)" }]}>
                          <Text style={[s.chipMark, { color: color.warning }]}>↑</Text>
                          <Text style={s.chipText}>{asText(cg)}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* ── Key Placements (insight cards) ────────────────── */}
                  {interp.keyPlacements?.length > 0 && (
                    <View style={s.placementSection}>
                      <Text style={s.sectionLabel}>KEY CELESTIAL PLACEMENTS</Text>
                      <Text style={s.sectionSub}>The placements doing the heavy lifting in your chart.</Text>
                      {interp.keyPlacements.map((k, i) => (
                        <View key={i} style={s.placementCard}>
                          <Text style={s.placementBody}>{asText(k)}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* ── Remedies as action steps ──────────────────────── */}
                  {interp.remedies?.length > 0 && (
                    <View style={s.remedySection}>
                      <Text style={[s.sectionLabel, { color: color.primaryLight }]}>🪔  COSMIC GUIDANCE</Text>
                      <Text style={s.sectionSub}>Behaviors and timings to align your karma.</Text>
                      {interp.remedies.map((r, i) => (
                        <View key={i} style={s.remedyRow}>
                          <Text style={s.remedyBody}>{asText(r)}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* ── Footer CTA ────────────────────────────────────── */}
                  <View style={s.footerCard}>
                    <Text style={s.footerKicker}>STILL CURIOUS?</Text>
                    <Text style={s.footerTitle}>Ask your astrologer</Text>
                    <Text style={s.footerBody}>
                      Pose any follow-up question. The answer is grounded only in your chart.
                    </Text>
                    <MagicButton style={{ width: "100%", marginTop: spacing.md }} onPress={() => navigation.navigate("Chat")}>
                      Open Chat  ↗
                    </MagicButton>
                  </View>

                  <Text style={s.disclaimer}>
                    Astrology is a tool for self-reflection. Celestial cycles reflect possibilities, not certainties.
                  </Text>
                </>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      <BottomNav activeKey={tab} navigation={navigation} onLocalTab={setTab} />
    </View>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function ProgressBar({ label, s: start, e: end, now, col }) {
  const color = useColors();
  const s = useStyles(makeStyles);
  const pct = Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100)));
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
        <Text style={{ fontSize: 11, color: color.textDim }}>{label}</Text>
        <Text style={{ fontSize: 11, color: color.textDim }}>{pct}% complete</Text>
      </View>
      <View style={s.barTrack}>
        <View style={{ width: `${pct}%`, height: "100%", backgroundColor: col, borderRadius: radius.pill }} />
      </View>
    </View>
  );
}

function DailyCard({
  form, dailyTransit, guide, monthDays, selDate, todayIso, savedDates, selectDay, loadDaily, dailyBusy,
  activeLoc, locError, getGpsLocation,
}) {
  const color = useColors();
  const s = useStyles(makeStyles);
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
            <Text style={{ fontSize: 11, color: color.primaryLight, fontWeight: "500" }}>
              📍 {activeLoc.n} (Live)
            </Text>
          ) : (
            <Pressable onPress={getGpsLocation}>
              <Text
                style={{
                  color: locError ? color.danger : color.primaryLight,
                  textDecorationLine: "underline",
                  fontSize: 11,
                }}
              >
                {locError ? "⚠️ GPS Blocked" : "📍 Use Live Location"}
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
          ...(dailyTransit.rahuKaal ? [["RAHU KAAL", `${dailyTransit.rahuKaal.start} – ${dailyTransit.rahuKaal.end}`]] : []),
        ].map(([l, v]) => (
          <View key={l} style={s.chip}>
            <Text style={[s.chipLabel, l === "RAHU KAAL" && { color: color.danger }]}>{l}</Text>
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
        <Pressable onPress={() => loadDaily(selDate)} disabled={dailyBusy} style={[s.revealBtn, dailyBusy && { opacity: 0.5 }]}>
          <Text style={s.revealText}>
            {dailyBusy ? "Reading the sky…" : "✨ Reveal This Day's Full Guidance"}
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

const makeStyles = (c) => StyleSheet.create({
  backBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.accentBorder,
    backgroundColor: c.accentSoft,
    marginBottom: spacing.lg,
  },
  backText: { color: c.accentLight, fontSize: 12, fontWeight: "600" },

  heroLabel: { color: c.primaryLight, fontSize: 13, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", textAlign: "center" },
  heroSub:   { color: c.textMuted, fontSize: 12, marginTop: 4, textAlign: "center" },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  headerTitleWrap: { flex: 1 },

  row3:    { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  bigThree: {
    flex: 1,
    backgroundColor: c.cardBgSolid,
    borderWidth: 1,
    borderColor: c.cardBorder,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
  },
  bigThreeLabel: { fontSize: 11, color: c.textMuted, textTransform: "uppercase", marginBottom: 4 },
  bigThreeValue: { fontSize: 14, lineHeight: 22, fontWeight: "700", color: c.text, textAlign: "center" },

  cardTitle: { color: c.text, fontSize: fontSize.md, lineHeight: 22, fontWeight: "700", marginBottom: 4 },
  cardSub:   { color: c.textMuted, fontSize: 11, marginBottom: spacing.md },
  body:      { color: c.textBody, fontSize: fontSize.sm, lineHeight: 20 },

  chartHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  styleBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: c.cardBorder,
  },
  styleBtnActive: { borderColor: c.accent, backgroundColor: c.accentSoft },
  styleBtnText:   { color: c.textDim, fontSize: 11 },
  legend:         { color: c.textFaint, fontSize: 10, textAlign: "center", marginTop: spacing.md, letterSpacing: 0.5 },

  scoreRow:   { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  scoreLabel: { color: c.textDim, fontSize: 12 },
  scoreValue: { fontWeight: "700", fontSize: 13 },
  scoreMax:   { color: c.textFaint, fontWeight: "400", fontSize: 10 },
  barTrack: {
    height: 6, backgroundColor: c.inputBg,
    borderRadius: radius.pill, overflow: "hidden",
  },

  tableHeader: {
    flexDirection: "row", paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: c.cardBorder,
  },
  thCell: { fontSize: 11, color: c.textMuted, letterSpacing: 0.5 },
  tableRow: {
    flexDirection: "row", paddingVertical: 10, alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.cardBorder,
  },
  tdCell: { fontSize: 12.5, lineHeight: 20, color: c.textBody },

  dashaCurrent: {
    backgroundColor: c.accentSoft,
    borderWidth: 1, borderColor: c.accentBorder,
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md,
  },
  dashaTitle: { color: c.text, fontWeight: "600", fontSize: 14 },
  dashaDates: { color: c.textDim, fontSize: 12, marginVertical: 8 },
  dashaRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.cardBorder,
  },
  dashaRowLabel: { color: c.textDim, fontSize: 13 },
  dashaRowDate:  { color: c.textMuted, fontSize: 12 },

  timelineItem:  { borderLeftWidth: 2, paddingLeft: 12, marginBottom: 14 },
  tlHeader:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tlPeriod:      { fontSize: 12.5, fontWeight: "600", color: c.text },
  tlNow:         { fontSize: 9, color: c.success, fontWeight: "700" },
  tlPhase:       { fontSize: 10, fontWeight: "600", borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  tlDates:       { fontSize: 10.5, color: c.textMuted, marginTop: 2, marginBottom: 6 },
  tlSummary:     { fontSize: 11.5, color: c.textDim, marginBottom: 7, lineHeight: 17 },
  tlHouse:       { fontSize: 9.5, color: c.textMuted, backgroundColor: c.inputBg, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },

  confRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  confTheme:  { color: c.text, fontSize: 12.5 },
  confCount:  { color: c.textMuted, fontSize: 10 },
  confLevel:  { fontSize: 10, fontWeight: "700", borderWidth: 1, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
  confSup:    { fontSize: 10.5, color: c.success, marginTop: 3 },

  sadeBad:  { backgroundColor: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.2)", borderWidth: 1, borderRadius: radius.md, padding: 12, marginBottom: 14 },
  sadeGood: { backgroundColor: "rgba(34,197,94,0.1)", borderColor: "rgba(34,197,94,0.2)", borderWidth: 1, borderRadius: radius.md, padding: 12, marginBottom: 14 },
  transitRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.cardBorder },

  aiBusyCard: {
    backgroundColor: c.cardBgSolid,
    borderWidth: 1.5,
    borderColor: c.warning,
  },
  aiBusyTitle: { color: c.warning, fontSize: 15, fontWeight: "700", textAlign: "center", marginTop: 8 },
  aiBusyBody:  { color: c.textBody, fontSize: 12.5, textAlign: "center", marginVertical: 12, lineHeight: 18 },
  loadingTitle: { color: c.text, fontSize: 16, fontWeight: "500", marginBottom: 8, textAlign: "center" },
  loadingSub:   { color: c.textMuted, fontSize: 12 },

  // ── Cosmic Blueprint hero ────────────────────────────────────────
  blueprint: {
    backgroundColor: c.primarySoft,
    borderWidth: 1, borderColor: c.primaryBorder,
    borderRadius: radius.xl, padding: spacing.xl, marginBottom: spacing.lg,
    alignItems: "center",
  },
  blueprintLabel: {
    color: c.primary, fontSize: 11, fontWeight: "800",
    letterSpacing: 4, marginBottom: 12,
  },
  blueprintDivider: {
    width: 36, height: 2, backgroundColor: c.primaryLight,
    borderRadius: 1, marginBottom: 14,
  },
  blueprintText: {
    color: c.text, fontSize: 18, fontStyle: "italic",
    textAlign: "center", lineHeight: 28, fontWeight: "500",
  },
  blueprintFooter: {
    color: c.textMuted, fontSize: 10, letterSpacing: 1,
    marginTop: 14, textTransform: "uppercase",
  },

  // ── Numbered narrative card ──────────────────────────────────────
  narrativeCard: {
    backgroundColor: c.cardBgSolid,
    borderWidth: 1, borderColor: "rgba(148,163,184,0.3)",
    borderLeftWidth: 4,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  narrativeHead: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  numberBadge: {
    width: 30, height: 30, borderRadius: 8,
    borderWidth: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: c.inputBg,
  },
  numberBadgeText: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  narrativeTitle:  { flex: 1, color: c.text, fontSize: 15, lineHeight: 22, fontWeight: "700" },
  narrativeBody:   { color: c.textBody, fontSize: 13.5, lineHeight: 23 },

  // ── Strengths / Growth panel cards ───────────────────────────────
  panelCard: {
    backgroundColor: c.cardBgSolid,
    borderWidth: 1, borderColor: "rgba(148,163,184,0.3)",
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  panelHead:   { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 8 },
  panelDot:    { width: 8, height: 8, borderRadius: 4 },
  panelTitle:  { fontSize: 13, fontWeight: "700", letterSpacing: 0.5 },
  chip: {
    flexDirection: "row", alignItems: "flex-start",
    paddingHorizontal: spacing.md, paddingVertical: 10,
    borderRadius: radius.md, borderWidth: 1,
    marginBottom: 8,
  },
  chipMark: { fontSize: 14, fontWeight: "700", marginRight: 8, marginTop: 1 },
  chipText: { flex: 1, color: c.textBody, fontSize: 13, lineHeight: 20 },

  // ── Key Placements ───────────────────────────────────────────────
  placementSection: { marginBottom: spacing.md },
  sectionLabel: {
    color: c.text, fontSize: 11, fontWeight: "800",
    letterSpacing: 2.5, marginBottom: 4,
  },
  sectionSub: { color: c.textMuted, fontSize: 11, marginBottom: spacing.md },
  placementCard: {
    flexDirection: "row",
    backgroundColor: c.cardBgSolid,
    borderWidth: 1, borderColor: "rgba(148,163,184,0.3)",
    borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 14,
    marginBottom: 10,
    gap: 12, alignItems: "flex-start",
  },
  placementGlyph: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: c.accentSoft,
    borderWidth: 1, borderColor: c.accentBorder,
    alignItems: "center", justifyContent: "center",
  },
  placementGlyphText: { color: c.accentLight, fontSize: 11, fontWeight: "800" },
  placementBody:      { flex: 1, color: c.textBody, fontSize: 13.5, lineHeight: 22 },

  // ── Remedies action steps ────────────────────────────────────────
  remedySection: {
    backgroundColor: c.primarySoft,
    borderWidth: 1, borderColor: c.primaryBorder,
    borderRadius: radius.lg, padding: spacing.lg,
    marginBottom: spacing.md,
  },
  remedyRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10, gap: 12 },
  remedyNum: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: c.primary, alignItems: "center", justifyContent: "center",
  },
  remedyNumText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  remedyBody:    { flex: 1, color: c.text, fontSize: 13.5, lineHeight: 22, fontWeight: "500" },

  // ── Footer CTA ───────────────────────────────────────────────────
  footerCard: {
    backgroundColor: c.cardBgSolid,
    borderWidth: 1, borderColor: "rgba(148,163,184,0.3)",
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginTop: spacing.md, marginBottom: spacing.lg,
    alignItems: "center",
  },
  footerKicker: {
    color: c.primaryLight, fontSize: 10, fontWeight: "700",
    letterSpacing: 3, marginBottom: 6,
  },
  footerTitle: { color: c.text, fontSize: 18, lineHeight: 24, fontWeight: "700" },
  footerBody:  { color: c.textDim, fontSize: 12.5, lineHeight: 18, textAlign: "center", marginTop: 6 },

  disclaimer: {
    fontSize: 11, color: c.textFaint, textAlign: "center",
    marginTop: spacing.xl, lineHeight: 18, letterSpacing: 0.5,
  },

  dayBtn: {
    width: 50, paddingVertical: 7, borderRadius: 12, alignItems: "center",
    borderWidth: 1, borderColor: c.cardBorder,
    backgroundColor: c.inputBg,
    position: "relative",
  },
  dayBtnActive:  { borderColor: c.primaryBorder, backgroundColor: c.primarySoft },
  dayBtnHasData: { borderColor: "rgba(74,222,128,0.4)", backgroundColor: "rgba(74,222,128,0.08)" },
  dayBtnTop:     { fontSize: 9, color: c.textDim, letterSpacing: 0.5 },
  dayBtnNum:     { fontSize: 16, fontWeight: "700", color: c.text },
  dayBtnMo:      { fontSize: 8, color: c.textMuted, opacity: 0.7 },
  dayDot:        { position: "absolute", top: 4, right: 6, width: 5, height: 5, borderRadius: 3, backgroundColor: c.success },

  alignPct: { fontSize: 26, fontWeight: "800", color: c.primaryLight, marginTop: spacing.sm },
  dayTitle: { fontSize: 15, fontWeight: "700", color: c.text, marginTop: 6 },
  dayIntro: { fontSize: 13, color: c.textDim, lineHeight: 21, marginTop: 4, marginBottom: 8 },
  dayMeta:  { fontSize: 11, color: c.textMuted, marginVertical: 4 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: spacing.md },
  chip: {
    minWidth: 120, flexGrow: 1,
    backgroundColor: c.inputBg,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
  },
  chipLabel: { fontSize: 9, color: c.textMuted, letterSpacing: 1 },
  chipValue: { fontSize: 12.5, fontWeight: "700", color: c.textBody, marginTop: 3 },

  action: { borderLeftWidth: 2, borderLeftColor: c.primaryLight, paddingLeft: 12, marginBottom: 14 },
  actionLabel: { fontSize: 10, color: c.textMuted, letterSpacing: 1 },
  actionText:  { fontSize: 13.5, color: c.textBody, fontStyle: "italic", marginTop: 3 },

  revealBtn: {
    paddingVertical: 11, borderRadius: 10,
    borderWidth: 1, borderColor: c.primaryBorder,
    backgroundColor: c.primarySoft, alignItems: "center",
  },
  revealText: { color: c.primaryLight, fontSize: 13, fontWeight: "600" },

  guideLabel: { fontSize: 10, color: c.primary, letterSpacing: 1.5, fontWeight: "600", marginBottom: 2 },
  guideText:  { fontSize: 12.5, color: c.textDim, lineHeight: 20 },
});
