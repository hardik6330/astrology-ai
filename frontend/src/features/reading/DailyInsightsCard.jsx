import { useEffect, useMemo, useRef, useState } from "react";
import { signOf, computeDaily } from "@/shared/astrology";
import { chatCompletionJSON, fetchSaved } from "../../services/api";
import { useQueryClient } from "@tanstack/react-query";
import { useDailyDates, kundaliKeys } from "@/features/kundali/hooks";
import Card from "@/common/Card";
import { useCosts } from "@/common/useCosts";
import { useCredits } from "@/common/useCredits";
import { EMOJIS } from "@/utils/emojis";

const WD_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const iso = (d) => d.toISOString().split("T")[0];

// Self-contained daily-guidance widget: detects GPS for accurate transit,
// shows a month date-strip, and fetches/generates AI guidance per day.
export default function DailyInsightsCard({ chart, form, onError }) {
  const costs = useCosts();
  const dailyCost = costs?.daily ?? 15;
  const credits = useCredits();
  const cityObj = useMemo(
    () =>
      form.lat != null && form.lon != null && form.tz != null
        ? { n: form.city, lat: form.lat, lon: form.lon, tz: form.tz }
        : null,
    [form.city, form.lat, form.lon, form.tz]
  );

  const [currentLoc, setCurrentLoc] = useState(null);
  const [, setLocError] = useState(false);
  const [dailyBusy, setDailyBusy] = useState(false);
  const [lowCredits, setLowCredits] = useState(false); // 402 on generate
  // Can't afford a day's guidance — either the balance is already too low or a
  // generate attempt just came back 402. Drives the disabled button label.
  const cannotAfford = lowCredits || (credits != null && credits < dailyCost);

  const getGpsLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        const tz = -(new Date().getTimezoneOffset() / 60);

        console.log(`[GPS] Detected Coordinates: Lat ${lat}, Lon ${lon}`);

        // Default label
        setCurrentLoc({ n: "Current Location", lat, lon, tz, isGps: true });
        setLocError(false);

        // Try to get the actual city name via Reverse Geocoding (Free OSM)
        try {
          const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;
          console.log(`[OSM] Fetching city name from: ${url}`);

          const res = await fetch(url, {
            headers: { "User-Agent": "AstrologyAI/1.0" },
          });
          const data = await res.json();

          console.log("[OSM] Received Data:", data);

          const a = data.address || {};
          const city =
            a.city ||
            a.town ||
            a.village ||
            a.municipality ||
            a.suburb ||
            a.neighbourhood ||
            a.county ||
            "Current Location";

          console.log(`[OSM] Resolved City: ${city}`);
          setCurrentLoc({ n: city, lat, lon, tz, isGps: true });
        } catch (e) {
          console.error("[OSM] Reverse Geocoding failed:", e.message);
        }
      },
      () => {
        setLocError(true);
      }
    );
  };

  // Detect user's current GPS location for accurate daily transit (Rahu Kaal, etc).
  useEffect(() => {
    getGpsLocation();
  }, []);

  const activeLoc = currentLoc || cityObj;

  const todayIso = iso(new Date());

  // Every day of the current month for the daily-guidance date strip.
  const monthDays = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear(),
      m = now.getMonth();
    const last = new Date(y, m + 1, 0).getDate();
    return Array.from({ length: last }, (_, i) => new Date(y, m, i + 1, 12, 0, 0, 0));
  }, []);

  const [selDate, setSelDate] = useState(() => new Date(new Date().setHours(12, 0, 0, 0)));
  const [guideMap, setGuideMap] = useState({}); // iso date -> AI guidance
  const todayBtnRef = useRef(null);

  // Dates with saved guidance — drives the "dot under date" indicator.
  // React Query caches per-form and refetches on form change automatically.
  const { data: savedDatesArr = [] } = useDailyDates(form);
  const savedDates = useMemo(() => new Set(savedDatesArr), [savedDatesArr]);
  const qc = useQueryClient();

  useEffect(() => {
    todayBtnRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, []);

  // Transit data (Moon sign, day lord, Rahu Kaal …) for the selected day.
  const dailyTransit = useMemo(() => computeDaily(chart, activeLoc, selDate), [chart, activeLoc, selDate]);
  const guide = guideMap[iso(selDate)] || null;

  // Fetch (or generate) the AI guidance for a given day.
  async function loadDaily(date) {
    const key = iso(date);
    if (dailyBusy || !chart || guideMap[key]) return;
    setDailyBusy(true);
    setLowCredits(false);
    const d = computeDaily(chart, activeLoc, date);
    const ctx = `PERSON: ${form.name || "Unknown"} | GENDER: ${form.gender || "NOT SPECIFIED — use name or they/them"}
NATAL: Lagna ${signOf(chart.angles.ascSid)}, Moon ${signOf(chart.planets[1].sid)}, Nakshatra ${chart.nakshatra}
DAY: ${d.weekday}, ${d.date.toDateString()} | Weekday ruling planet: ${d.dayLord}
Moon transits ${d.moonSign} — the ${d.moonHouseFromNatal}th house from the natal Moon
Day alignment score: ${d.alignment}% (higher = smoother day)
Running period: ${d.dasha}`;
    try {
      // Try the saved guidance for this date first; generate only if none exists.
      const saved = await fetchSaved("daily", form, key);
      const result = saved || (await chatCompletionJSON([], "daily", { ctx, form, date: key }));
      setGuideMap((m) => ({ ...m, [key]: result }));
      qc.invalidateQueries({ queryKey: kundaliKeys.dailyDates(form) });
    } catch (e) {
      if (e.code === "INSUFFICIENT_CREDITS") setLowCredits(true);
      else onError?.("Daily guidance failed: " + e.message);
    }
    setDailyBusy(false);
  }

  // Selecting a day shows it and loads its guidance (cached after first load).
  function selectDay(date) {
    setSelDate(date);
    loadDaily(date);
  }

  return (
    <Card>
      <div className="mb-3 flex items-start justify-between">
        <p className="m-0 text-sm font-semibold text-ink">
          {form.name || "Your"}
          {form.name ? "'s" : ""} Daily Insights
        </p>

        <div className="text-right">
          {activeLoc &&
            (activeLoc.isGps ? (
              <div className="text-[11px] font-medium text-accent">
                {EMOJIS.PIN} {activeLoc.n} (Live)
              </div>
            ) : (
              <div className="text-[11px] font-medium text-[#666]">
                {EMOJIS.HOUSE} {activeLoc.n}
              </div>
            ))}
        </div>
      </div>

      {/* Month strip — pick any day of the month to view / generate guidance.
      Days with a green dot already have saved guidance. */}
      <div
        className="mb-2 flex gap-1.5 overflow-x-auto pb-2"
        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(168,85,247,0.5) transparent" }}
      >
        {monthDays.map((d) => {
          const dIso = iso(d);
          const active = dIso === iso(selDate);
          const isToday = dIso === todayIso;
          const hasData = savedDates.has(dIso);
          return (
            <button
              key={dIso}
              ref={isToday ? todayBtnRef : null}
              onClick={() => selectDay(d)}
              className="relative flex w-12.5 flex-none cursor-pointer flex-col items-center gap-0.5 rounded-xl border py-1.75"
              // Active / has-saved-data states are computed → inline.
              style={{
                borderColor: active
                  ? "rgba(168,85,247,0.7)"
                  : hasData
                    ? "rgba(74,222,128,0.4)"
                    : "rgba(255,255,255,0.08)",
                background: active
                  ? "rgba(168,85,247,0.22)"
                  : hasData
                    ? "rgba(74,222,128,0.08)"
                    : "rgba(255,255,255,0.03)",
                color: active ? "#c084fc" : hasData ? "#86c8a0" : "#94a3b8",
              }}
            >
              <span className="text-[9px] tracking-[0.5px]">{isToday ? "TODAY" : WD_SHORT[d.getDay()]}</span>
              <span className="text-base font-bold">{d.getDate()}</span>
              <span className="text-[8px] opacity-70">{MONTHS[d.getMonth()]}</span>
              {hasData && <span className="absolute top-1 right-1.5 h-1.25 w-1.25 rounded-full bg-success" />}
            </button>
          );
        })}
      </div>

      <p className="m-0 mb-0.5 text-[26px] font-extrabold text-[#c084fc]">
        {dailyTransit.alignment}% Aligned
      </p>
      {guide && <p className="mx-0 mt-1.5 mb-1 text-[15px] font-bold text-ink">{guide.dayTitle}</p>}
      {guide && <p className="m-0 mb-3 text-[13px] leading-[1.65] text-subtle">{guide.intro}</p>}
      <p className="mx-0 mt-1 mb-3 text-[11px] text-muted">
        {dailyTransit.weekday} · ruled by {dailyTransit.dayLord} · Moon in {dailyTransit.moonSign}
      </p>

      <div className="mb-3.5 flex flex-wrap gap-2">
        {[
          ["WEAR", dailyTransit.luckyColor],
          ["MANIFEST", "◆ " + dailyTransit.luckyNumber],
          ...(dailyTransit.auspicious
            ? [["AUSPICIOUS", dailyTransit.auspicious.start + " – " + dailyTransit.auspicious.end]]
            : []),
          ...(dailyTransit.rahuKaal
            ? [["INAUSPICIOUS", dailyTransit.rahuKaal.start + " – " + dailyTransit.rahuKaal.end]]
            : []),
        ].map(([l, v]) => (
          <div key={l} className="flex-[1_1_120px] rounded-[10px] bg-white/4 px-3 py-2.25">
            <p
              className={`m-0 text-[9px] tracking-[1px] ${l === "INAUSPICIOUS" ? "text-danger" : "text-muted"}`}
            >
              {l}
            </p>
            <p className="mx-0 mt-0.75 mb-0 text-[12.5px] font-bold text-body">{v}</p>
          </div>
        ))}
      </div>

      {guide && guide.action && (
        <div className="mx-0 mb-3.5 border-l-2 border-[#c084fc] pl-3">
          <p className="m-0 text-[10px] tracking-[1px] text-muted">ACTION OF THE DAY</p>
          <p className="mx-0 mt-0.75 mb-0 text-[13.5px] text-body italic">"{guide.action}"</p>
        </div>
      )}

      {!guide && (
        <button
          onClick={() => loadDaily(selDate)}
          disabled={dailyBusy || cannotAfford}
          className="w-full cursor-pointer rounded-[10px] border border-[rgba(168,85,247,0.4)] bg-[rgba(168,85,247,0.12)] p-2.75 text-[13px] font-semibold text-[#c084fc] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {dailyBusy
            ? "Reading the sky…"
            : cannotAfford
              ? `Not enough credits · ${dailyCost} needed`
              : `${EMOJIS.SPARKLES} Reveal This Day's Full Guidance · ${dailyCost} Credits`}
        </button>
      )}
      {guide && (
        <div className="grid gap-2.5">
          {[
            ["SELF", guide.self],
            ["LOVE", guide.love],
            ["RELATIONSHIP", guide.relationship],
            ["FAMILY", guide.family],
            ["JOB", guide.job],
            ["HEALTH", guide.health],
            ["WEALTH", guide.wealth],
            ["SPIRITUAL", guide.spiritual],
            ["AVOID", guide.avoid],
          ].map(
            ([l, v]) =>
              v && (
                <div key={l}>
                  <p className="mx-0 mt-0 mb-0.5 text-[10px] font-semibold tracking-[1.5px] text-[#a855f7]">
                    {l}
                  </p>
                  <p className="m-0 text-[12.5px] leading-[1.6] text-subtle">{v}</p>
                </div>
              )
          )}
        </div>
      )}
    </Card>
  );
}
