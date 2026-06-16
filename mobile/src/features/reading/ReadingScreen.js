import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, BackHandler, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import Animated, { FadeIn, FadeInRight, FadeInLeft, Easing } from "react-native-reanimated";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import * as Location from "expo-location";
import BottomNav from "../../components/BottomNav";
import MenuButton from "../../components/MenuButton";
import CosmicBackdrop from "../../components/CosmicBackdrop";
import CosmicCard from "../../components/CosmicCard";
import { SkeletonReading } from "../../components/Skeleton";
import { useForm, useReading } from "../../context/ChartContext";
import { useColors } from "../../theme/ThemeContext";
import { useStyles } from "../../theme/useStyles";
import { spacing, fontSize } from "../../theme/tokens";
import { signOf, computeDaily, buildFactSheet } from "../../shared/astrology";
import { MSGS } from "../../shared/prompts";
import { chatCompletionJSON, fetchSaved, fetchDailyDates, reverseGeocode } from "../../services/api";
import { haptics } from "../../utils/haptics";
import { EMOJIS } from "../../utils/emojis";
import { useCredits } from "../../hooks/useCredits";
import { SUB_TABS, iso } from "./constants";
import { makeStyles } from "./styles";
import KundaliTab from "./sections/KundaliTab";
import PlanetsTab from "./sections/PlanetsTab";
import TimelineTab from "./sections/TimelineTab";
import ReadingTab from "./sections/ReadingTab";

// The 4 in-screen sub-tabs that swipe cycles through (palm/chat/profile are
// separate screens reached from the bottom nav, not swipeable).
const SWIPE_TABS = ["kundali", "planets", "timeline", "reading"];

export default function ReadingScreen({ navigation, route }) {
  const { form, chart, currentLoc, setCurrentLoc } = useForm();
  const { interp, setInterp } = useReading();
  const color = useColors();
  const s = useStyles(makeStyles);
  const [tab, setTab]             = useState(route.params?.tab || "kundali");
  // Direction of the last tab change (+1 next, -1 prev) → drives the slide-in
  // side so a swipe feels like the content follows the finger.
  const [dir, setDir]             = useState(1);
  const [chartStyle, setChartStyle] = useState("north");
  const credits = useCredits(); // wallet balance for the header badge

  // ── Swipe-between-tabs ──────────────────────────────────────────────────────
  // Step ±1 with a functional updater so the gesture never reads a stale `tab`.
  // Clamped at the ends (no wrap-around into palm). Declared before any early
  // return so hook order stays stable (rules-of-hooks).
  const goTab = useCallback((delta) => {
    setTab((cur) => {
      const i = SWIPE_TABS.indexOf(cur);
      if (i === -1) return cur; // not a swipeable tab → ignore
      const next = Math.min(SWIPE_TABS.length - 1, Math.max(0, i + delta));
      if (next === i) return cur; // already at the edge
      setDir(delta);
      haptics.select();
      return SWIPE_TABS[next];
    });
  }, []);

  // Tab-bar tap: set the slide direction from WHERE the tapped tab sits relative
  // to the current one (right of it → slide right, left → slide left) so the
  // content enters from the tapped side, matching the pill's glide.
  const selectTab = useCallback((key) => {
    setTab((cur) => {
      if (key === cur) return cur;
      const to = SWIPE_TABS.indexOf(key);
      const from = SWIPE_TABS.indexOf(cur);
      if (to !== -1 && from !== -1) setDir(to > from ? 1 : -1);
      return key;
    });
  }, []);

  // Horizontal pan that yields to the vertical ScrollView: activeOffsetX waits
  // for clear horizontal intent; failOffsetY cancels the moment the finger moves
  // vertically, so normal scrolling is untouched.
  const swipe = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true) // onEnd runs on the JS thread → call goTab directly
        .activeOffsetX([-24, 24])
        .failOffsetY([-16, 16])
        .onEnd((e) => {
          if (e.translationX <= -55) goTab(1);
          else if (e.translationX >= 55) goTab(-1);
        }),
    [goTab],
  );
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
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      const { latitude: lat, longitude: lon } = loc.coords;

      // Default label while resolving
      setCurrentLoc({ n: "Current Location", lat, lon, tz: 5.5, isGps: true });
      setLocError(false);

      try {
        // Resolve city and accurate timezone via backend
        const data = await reverseGeocode(lat, lon);
        setCurrentLoc({
          n: data.name,
          lat: data.lat,
          lon: data.lon,
          tz: data.timezone.offset,
          isGps: true,
        });
      } catch (e) {
        console.warn("[GPS] Reverse geocode failed:", e.message);
        // Fallback to phone timezone if backend fails
        const phoneTz = -(new Date().getTimezoneOffset() / 60);
        setCurrentLoc({ n: "Current Location", lat, lon, tz: phoneTz, isGps: true });
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

  // Load already-saved guidance for a day — free, no generation/charge. Used
  // when selecting a day that already has a reading (green dot).
  async function viewSaved(date) {
    const key = iso(date);
    if (dailyBusy || !chart || guideMap[key]) return;
    setDailyBusy(true);
    setDailyLowCredits(false);
    try {
      const saved = await fetchSaved("daily", form, key);
      if (saved) setGuideMap((m) => ({ ...m, [key]: saved }));
    } catch (e) {
      setError("Daily guidance failed: " + e.message);
    }
    setDailyBusy(false);
  }

  // Generate (and CHARGE) guidance for a day — only ever triggered by the user
  // tapping the "Reveal" button, so credits are never spent without consent.
  async function generateDaily(date) {
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
      // Saved-first guard: if it was generated elsewhere meanwhile, reuse it free.
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

  // Selecting a day shows it. If it already has saved guidance (green dot), load
  // it for free; otherwise leave it blank so the Reveal button prompts the user
  // to spend credits — never auto-generate on a date tap.
  function selectDay(date) {
    setSelDate(date);
    if (savedDates.has(iso(date))) viewSaved(date);
  }

  if (!chart) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg }}>
        <CosmicBackdrop />
        <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
          <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.sm, paddingTop: spacing.lg, paddingBottom: 95 }} showsVerticalScrollIndicator={false}>
            <SkeletonReading />
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <CosmicBackdrop />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.sm, paddingTop: spacing.lg, paddingBottom: 95 }} showsVerticalScrollIndicator={false}>
          <View style={s.headerRow}>
            <MenuButton />
            <View style={s.headerTitleWrap}>
                <Text style={s.heroLabel} numberOfLines={1}>
                  {form.name || "Your"}{form.name ? "'s" : ""} Cosmic Blueprint
                </Text>
                <Text style={s.heroSub} numberOfLines={1}>
                  {form.date} • {form.time} • {form.city}
                </Text>
              </View>
            {/* Wallet badge → Profile. Shows the live credit balance. */}
            <Pressable
              onPress={() => { haptics.tap(); navigation.navigate("Profile"); }}
              hitSlop={8}
              style={({ pressed }) => [s.walletBadge, pressed && { opacity: 0.7 }]}
            >
              <Text style={s.walletText}>{EMOJIS.SPARKLES} {credits ?? "—"}</Text>
            </Pressable>
          </View>

          {error ? (
            <CosmicCard error>
              <Text style={{ color: color.danger, fontSize: fontSize.sm }}>{EMOJIS.WARNING} {error}</Text>
            </CosmicCard>
          ) : null}

          {/* Swipe left/right to move between the 4 in-screen tabs. key={tab}
              remounts on switch so the section slides in from the side the swipe
              came from (dir): next → from right, prev → from left. */}
          <GestureDetector gesture={swipe}>
          <Animated.View
            key={tab}
            entering={(dir >= 0 ? FadeInRight : FadeInLeft).duration(180).easing(Easing.out(Easing.quad))}
          >
            {tab === "kundali" && (
              <KundaliTab
                chart={chart}
                chartStyle={chartStyle}
                setChartStyle={setChartStyle}
                daily={{
                  form, dailyTransit, guide, monthDays, selDate, todayIso,
                  savedDates, selectDay, generateDaily, dailyBusy, dailyLowCredits,
                  activeLoc, locError, getGpsLocation, navigation,
                }}
              />
            )}

            {tab === "planets" && <PlanetsTab chart={chart} now={now} />}

            {tab === "timeline" && <TimelineTab chart={chart} navigation={navigation} />}

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
          </GestureDetector>
        </ScrollView>
      </SafeAreaView>

      <BottomNav activeKey={tab} navigation={navigation} onLocalTab={selectTab} />
    </View>
  );
}
