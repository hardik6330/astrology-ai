import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, BackHandler } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import Animated, { FadeIn, FadeInRight } from "react-native-reanimated";
import * as Location from "expo-location";
import BottomNav from "../../components/BottomNav";
import MenuButton from "../../components/MenuButton";
import CosmicCard from "../../components/CosmicCard";
import { SkeletonReading } from "../../components/Skeleton";
import { useChart } from "../../context/ChartContext";
import { useColors } from "../../theme/ThemeContext";
import { useStyles } from "../../theme/useStyles";
import { spacing, fontSize } from "../../theme/tokens";
import { signOf, computeDaily, buildFactSheet } from "../../shared/astrology";
import { MSGS } from "../../shared/prompts";
import { chatCompletionJSON, fetchSaved, fetchDailyDates } from "../../services/api";
import { haptics } from "../../utils/haptics";
import { SUB_TABS, iso } from "./constants";
import { makeStyles } from "./styles";
import KundaliTab from "./sections/KundaliTab";
import PlanetsTab from "./sections/PlanetsTab";
import TimelineTab from "./sections/TimelineTab";
import ReadingTab from "./sections/ReadingTab";

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
  const [lowCredits, setLowCredits] = useState(false); // 402 on unlock
  const [dailyLowCredits, setDailyLowCredits] = useState(false); // 402 on daily generate
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

  // Reading is the home base once a chart exists. Android hardware back from
  // a sub-tab returns to Kundali; from Kundali it exits the app rather than
  // popping into the birth-form / PalmStep flow (which would start a fresh
  // reading). A new reading is only ever begun by editing birth data in
  // Profile → Home. No-op on iOS (no hardware back).
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        if (tab !== "kundali") { setTab("kundali"); return true; }
        BackHandler.exitApp();
        return true;
      };
      const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
      return () => sub.remove();
    }, [tab]),
  );

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
    setLowCredits(false);
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
      haptics.success();
    } catch (e) {
      if (e.code === "AI_OVERLOADED") {
        setOverloaded(true);
        setCooldown(40);
        haptics.warning();
      } else if (e.code === "INSUFFICIENT_CREDITS") {
        setLowCredits(true);
        haptics.warning();
      } else { setError(e.message); haptics.warning(); }
    } finally {
      clearInterval(iv);
      setLoading(false);
    }
  }

  // On mount (and chart change), load ONLY a previously-unlocked reading via a
  // free GET. We never auto-generate: generating costs credits, so it must be
  // triggered explicitly via the Unlock button in ReadingTab.
  useEffect(() => {
    if (!chart) return;
    fetchedRef.current = false;
  }, [chart]);

  useEffect(() => {
    if (!chart || interp || fetchedRef.current) return;
    fetchedRef.current = true;
    fetchSaved("interpret", form)
      .then((saved) => { if (saved) setInterp(saved); })
      .catch(() => {});
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
    setDailyLowCredits(false);
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
      if (e.code === "INSUFFICIENT_CREDITS") setDailyLowCredits(true);
      else setError("Daily guidance failed: " + e.message);
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

          {/* key={tab} remounts on every switch so the section cross-fades in
              instead of hard-cutting. */}
          <Animated.View key={tab} entering={FadeInRight.duration(300).springify()}>
            {tab === "kundali" && (
              <KundaliTab
                chart={chart}
                chartStyle={chartStyle}
                setChartStyle={setChartStyle}
                daily={{
                  form, dailyTransit, guide, monthDays, selDate, todayIso,
                  savedDates, selectDay, loadDaily, dailyBusy, dailyLowCredits,
                  activeLoc, locError, getGpsLocation, navigation,
                }}
              />
            )}

            {tab === "planets" && <PlanetsTab chart={chart} now={now} />}

            {tab === "timeline" && <TimelineTab chart={chart} />}

            {tab === "reading" && (
              <ReadingTab
                interp={interp}
                loading={loading}
                overloaded={overloaded}
                cooldown={cooldown}
                lowCredits={lowCredits}
                loadMsg={loadMsg}
                generateReading={generateReading}
                navigation={navigation}
                chart={chart}
                form={form}
              />
            )}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>

      <BottomNav activeKey={tab} navigation={navigation} onLocalTab={setTab} />
    </View>
  );
}
