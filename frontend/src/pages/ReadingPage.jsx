import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { signOf, ZE, fmtDate, fmtDay, computeDaily, buildFactSheet } from "../astrology";
import { MSGS } from "../prompts";
import { chatCompletionJSON, fetchSaved } from "../services/api";
import { useChart } from "../context/ChartContext";
import { useQueryClient } from "@tanstack/react-query";
import { useDailyDates, kundaliKeys } from "@/features/kundali/hooks";
import KundaliChart from "../components/KundaliChart";
import BottomNav from "../components/BottomNav";
import DoshaCard from "../components/DoshaCard";
import PanchangCard from "../components/PanchangCard";
import PlanetaryStrengthCard from "../components/PlanetaryStrengthCard";
import DashaWheel from "../components/DashaWheel";
import AshtakvargaWheel from "../components/AshtakvargaWheel";

// LLM output can drift from the requested JSON schema — e.g. a lite model
// returning bigThree as an object instead of a string. Coerce any value into
// renderable text so React never gets handed a raw object.
function asText(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(asText).join(" ");
  if (typeof v === "object") return Object.values(v).map(asText).join(" ");
  return String(v);
}

const WD_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Protected results page — chart, scores, dasha, transits, AI reading and chat.
export default function ReadingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { form, chart, interp, setInterp } = useChart();

  const [chartStyle, setChartStyle] = useState("north");
  // Default to the tab passed via navigation state (e.g. from BottomNav on /palm).
  const [tab, setTab] = useState(location.state?.tab || "kundali");

  // If we land here from elsewhere with a {state:{tab}} payload, honor it.
  useEffect(() => {
    if (location.state?.tab) setTab(location.state.tab);
  }, [location.state]);
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState(MSGS[0]);
  const [error, setError] = useState("");
  const [overloaded, setOverloaded] = useState(false); // AI tried 3× and gave up
  const [cooldown, setCooldown] = useState(0); // seconds until retry is allowed
  const [dailyBusy, setDailyBusy] = useState(false);
  const fetched = useRef(false);

  const cityObj = useMemo(
    () =>
      form.lat != null && form.lon != null && form.tz != null
        ? { n: form.city, lat: form.lat, lon: form.lon, tz: form.tz }
        : null,
    [form.city, form.lat, form.lon, form.tz]
  );

  const [currentLoc, setCurrentLoc] = useState(null);
  const [locError, setLocError] = useState(false);

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

  const iso = (d) => d.toISOString().split("T")[0];
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

  const [now] = useState(() => Date.now());

  // Generate the AI interpretation once when the page first mounts.
  // generateReading() is also called by the retry button when the AI was overloaded.
  async function generateReading() {
    if (!chart) return;
    setError("");
    setOverloaded(false);
    let mi = 0;
    setLoading(true);
    setLoadMsg(MSGS[0]);
    const iv = setInterval(() => {
      mi++;
      setLoadMsg(MSGS[mi % MSGS.length]);
    }, 2000);
    try {
      const saved = await fetchSaved("interpret", form);
      setInterp(
        saved || (await chatCompletionJSON([], "interpret", { factSheet: buildFactSheet(chart, form), form }))
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

  useEffect(() => {
    if (!chart || interp || fetched.current) return;
    fetched.current = true;
    generateReading();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart, interp, form]);

  // Cooldown tick — disables the retry button so users can't spam Pro
  // while it's overloaded.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // Fetch (or generate) the AI guidance for a given day.
  async function loadDaily(date) {
    const key = iso(date);
    if (dailyBusy || !chart || guideMap[key]) return;
    setDailyBusy(true);
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
      setError("Daily guidance failed: " + e.message);
    }
    setDailyBusy(false);
  }

  // Selecting a day shows it and loads its guidance (cached after first load).
  function selectDay(date) {
    setSelDate(date);
    loadDaily(date);
  }

  const sunV = signOf(chart.planets[0].sid);
  const moonV = signOf(chart.planets[1].sid);
  const ascV = signOf(chart.angles.ascSid);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1rem 7.5rem", position: "relative" }}>
      <div className="cosmos"></div>
      <div className="stars"></div>
      <div className="shooting-star"></div>

      <button
        onClick={() => navigate("/", { state: { edit: true } })}
        style={{
          fontSize: 12,
          padding: "8px 16px",
          borderRadius: 8,
          cursor: "pointer",
          color: "#a5b4fc",
          border: "1px solid rgba(99,102,241,0.4)",
          background: "rgba(99,102,241,0.1)",
          marginBottom: 20,
        }}
      >
        ← New Reading
      </button>

      {error && (
        <div className="cosmic-card" style={{ borderColor: "#ef4444", background: "rgba(239, 68, 68, 0.1)" }}>
          <p style={{ color: "#f87171", fontSize: 14, margin: 0 }}>⚠️ {error}</p>
        </div>
      )}

      <div style={{ animation: "slideUp 0.8s ease-out" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <p
            style={{
              fontSize: 13,
              color: "#6366f1",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            {form.name || "Seeker"}'s Cosmic Map
          </p>
          <p style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
            {form.dob} • {form.time} • {form.city}
          </p>
        </div>

        {/* Common header — Big Three + Nakshatra + Daily Insights. Shown ONLY on
            the Kundali tab; other tabs go straight into their focused content. */}
        {tab === "kundali" && (
          <>
            <div className="grid-3" style={{ marginBottom: 20 }}>
              {[
                ["Sun Sign", sunV, "☀️"],
                ["Moon Sign", moonV, "🌙"],
                ["Lagna", ascV, "⬆"],
              ].map(([l, v, ic]) => (
                <div key={l} className="big-three-card">
                  <span className="astrology-icon">{ic}</span>
                  <p style={{ fontSize: 11, color: "#888", margin: "0 0 4px", textTransform: "uppercase" }}>
                    {l}
                  </p>
                  <p style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#fff" }}>
                    {ZE[v] || ""} {v}
                  </p>
                </div>
              ))}
            </div>

            <div className="cosmic-card" style={{ textAlign: "center", padding: "12px" }}>
              <p style={{ fontSize: 13, color: "#fbbf24", margin: 0, fontWeight: 500 }}>
                🌙 Janma Nakshatra: <span style={{ fontSize: 15, fontWeight: 700 }}>{chart.nakshatra}</span>
              </p>
            </div>

            {/* Daily Guidance */}
            <div className="cosmic-card">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 12,
                }}
              >
                <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "#fff" }}>
                  {form.name || "Your"}
                  {form.name ? "'s" : ""} Daily Insights
                </p>

                <div style={{ textAlign: "right" }}>
                  {activeLoc?.isGps ? (
                    <div style={{ fontSize: 11, color: "#6366f1", fontWeight: 500 }}>
                      📍 {activeLoc.n} (Live)
                    </div>
                  ) : (
                    <button
                      onClick={getGpsLocation}
                      style={{
                        color: locError ? "#f87171" : "#6366f1",
                        textDecoration: "underline",
                        background: "none",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                        fontSize: 11,
                      }}
                    >
                      {locError ? "⚠️ GPS Blocked" : "📍 Use Live Location"}
                    </button>
                  )}
                </div>
              </div>

              {/* Month strip — pick any day of the month to view / generate guidance.
              Days with a green dot already have saved guidance. */}
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  overflowX: "auto",
                  marginBottom: 8,
                  paddingBottom: 8,
                  scrollbarWidth: "thin",
                  scrollbarColor: "rgba(168,85,247,0.5) transparent",
                }}
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
                      style={{
                        flex: "0 0 auto",
                        width: 50,
                        padding: "7px 0",
                        borderRadius: 12,
                        cursor: "pointer",
                        position: "relative",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 2,
                        border:
                          "1px solid " +
                          (active
                            ? "rgba(168,85,247,0.7)"
                            : hasData
                              ? "rgba(74,222,128,0.4)"
                              : "rgba(255,255,255,0.08)"),
                        background: active
                          ? "rgba(168,85,247,0.22)"
                          : hasData
                            ? "rgba(74,222,128,0.08)"
                            : "rgba(255,255,255,0.03)",
                        color: active ? "#c084fc" : hasData ? "#86c8a0" : "#94a3b8",
                      }}
                    >
                      <span style={{ fontSize: 9, letterSpacing: "0.5px" }}>
                        {isToday ? "TODAY" : WD_SHORT[d.getDay()]}
                      </span>
                      <span style={{ fontSize: 16, fontWeight: 700 }}>{d.getDate()}</span>
                      <span style={{ fontSize: 8, opacity: 0.7 }}>{MONTHS[d.getMonth()]}</span>
                      {hasData && (
                        <span
                          style={{
                            position: "absolute",
                            top: 4,
                            right: 6,
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            background: "#4ade80",
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              <p style={{ fontSize: 26, fontWeight: 800, color: "#c084fc", margin: "0 0 2px" }}>
                {dailyTransit.alignment}% Aligned
              </p>
              {guide && (
                <p style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: "6px 0 4px" }}>
                  {guide.dayTitle}
                </p>
              )}
              {guide && (
                <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.65, margin: "0 0 12px" }}>
                  {guide.intro}
                </p>
              )}
              <p style={{ fontSize: 11, color: "#64748b", margin: "4px 0 12px" }}>
                {dailyTransit.weekday} · ruled by {dailyTransit.dayLord} · Moon in {dailyTransit.moonSign}
              </p>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                {[
                  ["WEAR", dailyTransit.luckyColor],
                  ["MANIFEST", "◆ " + dailyTransit.luckyNumber],
                  ...(dailyTransit.auspicious
                    ? [["AUSPICIOUS", dailyTransit.auspicious.start + " – " + dailyTransit.auspicious.end]]
                    : []),
                  ...(dailyTransit.rahuKaal
                    ? [["RAHU KAAL", dailyTransit.rahuKaal.start + " – " + dailyTransit.rahuKaal.end]]
                    : []),
                ].map(([l, v]) => (
                  <div
                    key={l}
                    style={{
                      flex: "1 1 120px",
                      background: "rgba(255,255,255,0.04)",
                      borderRadius: 10,
                      padding: "9px 12px",
                    }}
                  >
                    <p
                      style={{
                        fontSize: 9,
                        color: l === "RAHU KAAL" ? "#f87171" : "#64748b",
                        margin: 0,
                        letterSpacing: "1px",
                      }}
                    >
                      {l}
                    </p>
                    <p style={{ fontSize: 12.5, fontWeight: 700, color: "#e2e8f0", margin: "3px 0 0" }}>
                      {v}
                    </p>
                  </div>
                ))}
              </div>

              {guide && guide.action && (
                <div style={{ borderLeft: "2px solid #c084fc", paddingLeft: 12, margin: "0 0 14px" }}>
                  <p style={{ fontSize: 10, color: "#64748b", margin: 0, letterSpacing: "1px" }}>
                    ACTION OF THE DAY
                  </p>
                  <p style={{ fontSize: 13.5, color: "#e2e8f0", fontStyle: "italic", margin: "3px 0 0" }}>
                    "{guide.action}"
                  </p>
                </div>
              )}

              {!guide && (
                <button
                  onClick={() => loadDaily(selDate)}
                  disabled={dailyBusy}
                  style={{
                    width: "100%",
                    padding: "11px",
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: dailyBusy ? "not-allowed" : "pointer",
                    color: "#c084fc",
                    border: "1px solid rgba(168,85,247,0.4)",
                    background: "rgba(168,85,247,0.12)",
                    opacity: dailyBusy ? 0.5 : 1,
                  }}
                >
                  {dailyBusy ? "Reading the sky…" : "✨ Reveal This Day's Full Guidance"}
                </button>
              )}
              {guide && (
                <div style={{ display: "grid", gap: 10 }}>
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
                          <p
                            style={{
                              fontSize: 10,
                              color: "#a855f7",
                              margin: "0 0 2px",
                              letterSpacing: "1.5px",
                              fontWeight: 600,
                            }}
                          >
                            {l}
                          </p>
                          <p style={{ fontSize: 12.5, color: "#cbd5e1", lineHeight: 1.6, margin: 0 }}>{v}</p>
                        </div>
                      )
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* ─────────── TAB: Kundali ─────────── */}
        {tab === "kundali" && (
          <>
            {/* Kundali chart wheel */}
            <div className="cosmic-card">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "#fff" }}>Celestial Wheel</p>
                <div style={{ display: "flex", gap: 8 }}>
                  {[
                    ["north", "North"],
                    ["south", "South"],
                  ].map(([v, l]) => (
                    <button
                      key={v}
                      onClick={() => setChartStyle(v)}
                      style={{
                        fontSize: 11,
                        padding: "6px 12px",
                        borderRadius: 8,
                        cursor: "pointer",
                        color: "inherit",
                        border: "1px solid " + (chartStyle === v ? "#6366f1" : "#444"),
                        background: chartStyle === v ? "rgba(99, 102, 241, 0.2)" : "transparent",
                      }}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <KundaliChart chart={chart} variant={chartStyle} />
              <p
                style={{
                  fontSize: 10,
                  color: "#555",
                  textAlign: "center",
                  marginTop: 12,
                  letterSpacing: "0.5px",
                }}
              >
                Su:Sun • Mo:Moon • Ma:Mars • Me:Mercury • Ju:Jupiter • Ve:Venus • Sa:Saturn • Ra:Rahu •
                Ke:Ketu
              </p>
            </div>

            {/* New: Dosha & Yoga Status */}
            <DoshaCard doshas={chart.doshas} />

            {/* New: Panchang Snapshot */}
            <PanchangCard panchang={chart.panchang} />

            {/* Life-area scores */}
            <div className="cosmic-card">
              <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 16px", color: "#fff" }}>
                Destiny Matrix
              </p>
              {chart.scores.map((s) => {
                const col = s.score >= 70 ? "#4ade80" : s.score >= 45 ? "#fbbf24" : "#f87171";
                return (
                  <details key={s.key} style={{ marginBottom: 14 }}>
                    <summary style={{ listStyle: "none", cursor: "pointer" }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 12,
                          marginBottom: 6,
                        }}
                      >
                        <span style={{ color: "#94a3b8" }}>
                          {s.key} <span style={{ color: "#555", fontSize: 10 }}>▸ why</span>
                        </span>
                        <span style={{ color: col, fontWeight: 700 }}>
                          {s.score}
                          <span style={{ color: "#444", fontWeight: 400, marginLeft: 2 }}>/100</span>
                        </span>
                      </div>
                      <div
                        style={{
                          height: 6,
                          background: "rgba(255,255,255,0.05)",
                          borderRadius: 10,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: s.score + "%",
                            height: "100%",
                            background: col,
                            boxShadow: `0 0 10px ${col}44`,
                          }}
                        />
                      </div>
                    </summary>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, margin: "8px 0 4px" }}>
                      {(s.factors || []).map((f, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: 10,
                            color: "#8b9bb0",
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.07)",
                            borderRadius: 5,
                            padding: "2px 7px",
                          }}
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          </>
        )}

        {/* ─────────── TAB: Planets ─────────── */}
        {tab === "planets" && (
          <>
            {/* New: Planetary Strength meter */}
            <PlanetaryStrengthCard strengths={chart.strengths} />

            {/* Planet table */}
            <div className="cosmic-card">
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  margin: "0 0 2px",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span className="astrology-icon" style={{ fontSize: 18, margin: 0 }}>
                  🪐
                </span>{" "}
                Planetary Positions
              </p>
              <p style={{ fontSize: 10.5, color: "#64748b", margin: "0 0 16px" }}>
                Whole-sign house system — each sign is one full house, so a planet's house does not depend on
                its degree.
              </p>
              <div
                className="planet-row"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.2fr 1.5fr 1.5fr 0.6fr",
                  fontSize: 11,
                  color: "#666",
                  paddingBottom: 8,
                  borderBottom: "1px solid rgba(255,255,255,0.1)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                <span>Planet</span>
                <span>Vedic</span>
                <span>Western</span>
                <span>House</span>
              </div>
              {chart.planets.map((p) => (
                <div
                  key={p.name}
                  className="planet-row"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.2fr 1.5fr 1.5fr 0.6fr",
                    fontSize: 13,
                    padding: "10px 0",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                    alignItems: "center",
                  }}
                >
                  <span style={{ color: "#aaa", fontWeight: 500 }}>
                    {p.name}
                    {p.retro && <span style={{ color: "#f87171", fontSize: 11, marginLeft: 4 }}>℞</span>}
                  </span>
                  <span style={{ color: "#ddd" }}>
                    {ZE[signOf(p.sid)]} {signOf(p.sid)}
                  </span>
                  <span style={{ color: "#ddd" }}>
                    {ZE[signOf(p.trop)]} {signOf(p.trop)}
                  </span>
                  <span style={{ color: "#888", textAlign: "center" }}>{p.houseSid}</span>
                </div>
              ))}
            </div>

            {/* Vimshottari Dasha */}
            <div className="cosmic-card">
              <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 16px", color: "#fff" }}>
                Planetary Timing (Dasha)
              </p>
              <div
                style={{
                  background: "rgba(99, 102, 241, 0.1)",
                  border: "1px solid rgba(99, 102, 241, 0.2)",
                  borderRadius: 12,
                  padding: "16px",
                  marginBottom: 16,
                }}
              >
                <p style={{ fontSize: 14, color: "#fff", fontWeight: 600, margin: 0 }}>
                  {chart.curMaha.lord} Mahadasha
                  {chart.curAntar && (
                    <span style={{ color: "#a855f7" }}> · {chart.curAntar.lord} Antardasha</span>
                  )}
                </p>
                <p style={{ fontSize: 12, color: "#94a3b8", margin: "4px 0 16px" }}>
                  {fmtDate(chart.curMaha.start)} – {fmtDate(chart.curMaha.end)}
                </p>
                {(() => {
                  const bar = (label, s, e, col) => {
                    const pct = Math.max(0, Math.min(100, Math.round(((now - s) / (e - s)) * 100)));
                    return (
                      <div style={{ marginBottom: 10 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 11,
                            color: "#94a3b8",
                            marginBottom: 4,
                          }}
                        >
                          <span>{label}</span>
                          <span>{pct}% complete</span>
                        </div>
                        <div
                          style={{
                            height: 6,
                            background: "rgba(255,255,255,0.05)",
                            borderRadius: 10,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: pct + "%",
                              height: "100%",
                              background: col,
                              boxShadow: `0 0 10px ${col}44`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  };
                  return (
                    <div>
                      {bar(chart.curMaha.lord, +chart.curMaha.start, +chart.curMaha.end, "#6366f1")}
                      {chart.curAntar &&
                        bar(chart.curAntar.lord, +chart.curAntar.start, +chart.curAntar.end, "#a855f7")}
                    </div>
                  );
                })()}
              </div>
              {chart.dasha
                .filter((m) => m.end > new Date())
                .slice(0, 5)
                .map((m, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 13,
                      padding: "10px 0",
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <span
                      style={{
                        color: m === chart.curMaha ? "#fff" : "#94a3b8",
                        fontWeight: m === chart.curMaha ? 600 : 400,
                      }}
                    >
                      {m.lord} Mahadasha
                    </span>
                    <span style={{ color: "#666", fontSize: 12 }}>
                      {fmtDate(m.start)} – {fmtDate(m.end)}
                    </span>
                  </div>
                ))}
            </div>
          </>
        )}

        {/* ─────────── TAB: Timeline ─────────── */}
        {tab === "timeline" && (
          <>
            {/* New: Dasha Timeline Wheel */}
            <DashaWheel chart={chart} />

            {/* New: Ashtakvarga Wheel */}
            <AshtakvargaWheel ashtakvarga={chart.ashtakvarga} />

            {/* Timeline Forecast */}
            <div className="cosmic-card">
              <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px", color: "#fff" }}>
                Timeline Forecast
              </p>
              <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 16px" }}>
                Upcoming dasha windows — computed, with the reasoning shown
              </p>
              {chart.predictions.map((p, i) => {
                const tc = p.tone === "supportive" ? "#4ade80" : p.tone === "testing" ? "#f87171" : "#fbbf24";
                return (
                  <div key={i} style={{ borderLeft: `2px solid ${tc}`, paddingLeft: 12, marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: "#e2e8f0" }}>
                        {p.period}
                        {p.current && (
                          <span
                            style={{
                              fontSize: 9,
                              color: "#4ade80",
                              marginLeft: 6,
                              border: "1px solid #4ade80",
                              borderRadius: 4,
                              padding: "1px 5px",
                            }}
                          >
                            NOW
                          </span>
                        )}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          color: tc,
                          fontWeight: 600,
                          border: `1px solid ${tc}55`,
                          borderRadius: 4,
                          padding: "2px 7px",
                        }}
                      >
                        {p.phase}
                      </span>
                    </div>
                    <p style={{ fontSize: 10.5, color: "#64748b", margin: "2px 0 6px" }}>
                      {fmtDate(p.start)} – {fmtDate(p.end)}
                    </p>
                    <p style={{ fontSize: 11.5, color: "#cbd5e1", margin: "0 0 7px", lineHeight: 1.55 }}>
                      {p.summary}
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 5 }}>
                      {p.areas.map((a, j) => (
                        <span
                          key={j}
                          style={{
                            fontSize: 9.5,
                            color: "#64748b",
                            background: "rgba(255,255,255,0.04)",
                            borderRadius: 4,
                            padding: "2px 7px",
                          }}
                        >
                          H{a.house}
                        </span>
                      ))}
                    </div>
                    <details>
                      <summary style={{ fontSize: 10, color: "#64748b", cursor: "pointer" }}>
                        why this window
                      </summary>
                      {p.why.map((w, j) => (
                        <p key={j} style={{ fontSize: 10, color: "#8b9bb0", margin: "3px 0 0" }}>
                          • {w}
                        </p>
                      ))}
                    </details>
                  </div>
                );
              })}
            </div>

            {/* Confidence engine */}
            <div className="cosmic-card">
              <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px", color: "#fff" }}>
                Prediction Confidence
              </p>
              <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 16px" }}>
                How many independent chart signatures back each theme
              </p>
              {chart.confidence.map((c, i) => {
                const lc = c.level === "High" ? "#4ade80" : c.level === "Moderate" ? "#fbbf24" : "#f87171";
                return (
                  <details key={i} style={{ marginBottom: 12 }}>
                    <summary
                      style={{
                        listStyle: "none",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ fontSize: 12.5, color: "#e2e8f0" }}>
                        {c.theme} <span style={{ color: "#555", fontSize: 10 }}>▸</span>
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 10, color: "#64748b" }}>
                          {c.count}/{c.total}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            color: lc,
                            fontWeight: 700,
                            border: `1px solid ${lc}55`,
                            borderRadius: 4,
                            padding: "2px 8px",
                          }}
                        >
                          {c.level}
                        </span>
                      </span>
                    </summary>
                    <div style={{ margin: "8px 0 2px" }}>
                      {c.supporting.map((s, j) => (
                        <p key={j} style={{ fontSize: 10.5, color: "#86c8a0", margin: "3px 0" }}>
                          ✓ {s}
                        </p>
                      ))}
                      {c.missing.map((s, j) => (
                        <p key={j} style={{ fontSize: 10.5, color: "#5a6577", margin: "3px 0" }}>
                          ○ {s}
                        </p>
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>

            {/* Transits */}
            <div className="cosmic-card">
              <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 16px", color: "#fff" }}>
                Current Sky (Gochar)
              </p>
              {chart.transits.sadeSati.active ? (
                <div
                  style={{
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.2)",
                    borderRadius: 12,
                    padding: "12px",
                    marginBottom: 16,
                  }}
                >
                  <p style={{ fontSize: 13, color: "#f87171", fontWeight: 700, margin: 0 }}>
                    ⚠ Sade Sati Phase: {chart.transits.sadeSati.phase}
                  </p>
                  <p style={{ fontSize: 11, color: "#fca5a5", margin: "4px 0 0" }}>
                    Ends: {chart.transits.sadeSati.end ? fmtDay(chart.transits.sadeSati.end) : "ongoing"}
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    background: "rgba(34, 197, 94, 0.1)",
                    border: "1px solid rgba(34, 197, 94, 0.2)",
                    borderRadius: 12,
                    padding: "12px",
                    marginBottom: 16,
                  }}
                >
                  <p style={{ fontSize: 13, color: "#4ade80", fontWeight: 600, margin: 0 }}>
                    ✓ Free from Sade Sati
                  </p>
                </div>
              )}
              {chart.transits.positions.map((p) => (
                <div
                  key={p.name}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 13,
                    padding: "10px 0",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <span style={{ color: "#94a3b8" }}>{p.name}</span>
                  <span style={{ color: "#fff" }}>
                    {ZE[p.sign]} {p.sign}{" "}
                    <span style={{ color: "#666", fontSize: 11, marginLeft: 6 }}>
                      • {p.houseMoon}th from Moon
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ─────────── TAB: Insights (AI reading) ─────────── */}
        {tab === "reading" && (
          <>
            {overloaded && !interp && (
              <div
                className="cosmic-card"
                style={{
                  textAlign: "center",
                  borderColor: "rgba(251,191,36,0.4)",
                  background: "rgba(251,191,36,0.08)",
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 8 }}>⏳</div>
                <p style={{ color: "#fbbf24", fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>
                  AI is busy right now
                </p>
                <p style={{ color: "#cbd5e1", fontSize: 12.5, margin: "0 0 16px", lineHeight: 1.6 }}>
                  Our reader couldn't complete your reading after several tries.
                  {cooldown > 0 ? " Please wait a moment before trying again." : " You can try again now."}
                </p>
                <button
                  onClick={generateReading}
                  disabled={cooldown > 0}
                  className="magic-btn"
                  style={{
                    width: "100%",
                    opacity: cooldown > 0 ? 0.5 : 1,
                    cursor: cooldown > 0 ? "not-allowed" : "pointer",
                  }}
                >
                  {cooldown > 0 ? `🕒 Try Again in ${cooldown}s` : "🔄 Try Again"}
                </button>
              </div>
            )}
            {loading && !interp && (
              <div className="cosmic-card" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
                <div className="astrology-icon" style={{ fontSize: 40, marginBottom: 20 }}>
                  🔮
                </div>
                <p style={{ color: "#fff", fontSize: 16, fontWeight: 500, marginBottom: 8 }}>{loadMsg}</p>
                <p style={{ color: "#666", fontSize: 12 }}>The stars are aligning for you...</p>
              </div>
            )}

            {interp && (
              <div style={{ animation: "slideUp 0.8s ease-out" }}>
                <div
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%)",
                    border: "1px solid rgba(168, 85, 247, 0.3)",
                    borderRadius: 20,
                    padding: "clamp(1.25rem, 5vw, 2rem)",
                    marginBottom: 24,
                    boxShadow: "0 0 30px rgba(168, 85, 247, 0.15)",
                    textAlign: "center",
                  }}
                >
                  <p
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#a855f7",
                      margin: "0 0 12px",
                      textTransform: "uppercase",
                      letterSpacing: "3px",
                    }}
                  >
                    Cosmic Blueprint
                  </p>
                  <p
                    style={{
                      fontSize: "clamp(15px, 4.2vw, 20px)",
                      fontWeight: 600,
                      color: "#fff",
                      margin: 0,
                      lineHeight: 1.6,
                      fontStyle: "italic",
                    }}
                  >
                    "{asText(interp.lifeTheme)}"
                  </p>
                </div>

                <div style={{ display: "grid", gap: 16 }}>
                  {[
                    ["Core Identity", "✨", asText(interp.bigThree)],
                    ["Personality Matrix", "👤", asText(interp.personality)],
                    ["Destiny & Purpose", "💼", asText(interp.career)],
                    ["Heart & Soul", "💛", asText(interp.relationships)],
                  ].map(
                    ([title, icon, content], idx) =>
                      content && (
                        <div
                          key={title}
                          className="cosmic-card"
                          style={{ margin: 0, animationDelay: `${idx * 0.1}s` }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                            <span className="astrology-icon" style={{ margin: 0, fontSize: 22 }}>
                              {icon}
                            </span>
                            <p
                              style={{
                                fontSize: 15,
                                fontWeight: 700,
                                margin: 0,
                                color: "#fff",
                                letterSpacing: "0.5px",
                              }}
                            >
                              {title}
                            </p>
                          </div>
                          <p style={{ fontSize: 13, color: "#94a3b8", margin: 0, lineHeight: 1.7 }}>
                            {content}
                          </p>
                        </div>
                      )
                  )}
                </div>

                <div className="grid-2" style={{ margin: "20px 0" }}>
                  <div
                    className="cosmic-card"
                    style={{
                      margin: 0,
                      borderColor: "rgba(34, 197, 94, 0.2)",
                      background: "rgba(20, 30, 20, 0.4)",
                    }}
                  >
                    <p
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: "#4ade80",
                        marginBottom: 16,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span style={{ fontSize: 20 }}>✦</span> Celestial Strengths
                    </p>
                    {(interp.strengths || []).map((s, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          gap: 10,
                          marginBottom: 10,
                          fontSize: 14,
                          color: "#94a3b8",
                          lineHeight: 1.5,
                        }}
                      >
                        <span style={{ color: "#4ade80", fontWeight: 700 }}>✓</span>
                        <span>{asText(s)}</span>
                      </div>
                    ))}
                  </div>
                  <div
                    className="cosmic-card"
                    style={{
                      margin: 0,
                      borderColor: "rgba(251, 191, 36, 0.2)",
                      background: "rgba(30, 25, 20, 0.4)",
                    }}
                  >
                    <p
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: "#fbbf24",
                        marginBottom: 16,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span style={{ fontSize: 20 }}>✦</span> Growth Thresholds
                    </p>
                    {(interp.challenges || []).map((c, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          gap: 10,
                          marginBottom: 10,
                          fontSize: 14,
                          color: "#94a3b8",
                          lineHeight: 1.5,
                        }}
                      >
                        <span style={{ color: "#fbbf24", fontWeight: 700 }}>↑</span>
                        <span>{asText(c)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {interp.keyPlacements && (
                  <div className="cosmic-card">
                    <p style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px", color: "#fff" }}>
                      🔑 Key Celestial Placements
                    </p>
                    <div style={{ display: "grid", gap: 12 }}>
                      {interp.keyPlacements.map((k, i) => (
                        <p
                          key={i}
                          style={{
                            fontSize: 14.5,
                            color: "#94a3b8",
                            margin: 0,
                            lineHeight: 1.7,
                            padding: "12px 16px",
                            background: "rgba(255,255,255,0.03)",
                            borderRadius: 12,
                            borderLeft: "4px solid #6366f1",
                          }}
                        >
                          {asText(k)}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {interp.remedies && (
                  <div
                    className="cosmic-card"
                    style={{ borderColor: "rgba(168, 85, 247, 0.2)", background: "rgba(30, 20, 30, 0.4)" }}
                  >
                    <p style={{ fontSize: 16, fontWeight: 700, color: "#c084fc", margin: "0 0 16px" }}>
                      🪔 Cosmic Guidance & Remedies
                    </p>
                    <div style={{ display: "grid", gap: 10 }}>
                      {interp.remedies.map((r, i) => (
                        <p
                          key={i}
                          style={{
                            fontSize: 14.5,
                            color: "#c084fc",
                            margin: 0,
                            lineHeight: 1.7,
                            display: "flex",
                            gap: 10,
                          }}
                        >
                          <span style={{ opacity: 0.8 }}>✨</span> <span>{asText(r)}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Follow-up chat lives on its own route */}
                <div className="cosmic-card" style={{ marginTop: 24, textAlign: "center" }}>
                  <p style={{ fontSize: 16, fontWeight: 700, color: "#c084fc", margin: "0 0 4px" }}>
                    💬 Ask About Your Kundli
                  </p>
                  <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 16px" }}>
                    Ask anything about your future, career, marriage or timing — answered from your chart
                    only.
                  </p>
                  <button onClick={() => navigate("/chat")} className="magic-btn" style={{ width: "100%" }}>
                    Open Chat ↗
                  </button>
                </div>

                <p
                  style={{
                    fontSize: 11,
                    color: "#444",
                    textAlign: "center",
                    marginTop: 40,
                    lineHeight: 1.8,
                    maxWidth: 500,
                    margin: "40px auto 0",
                    letterSpacing: "0.5px",
                  }}
                >
                  Disclaimer: Astrology is a tool for self-reflection and spiritual insight. Celestial cycles
                  reflect possibilities, not certainties. Always use your own judgment.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <BottomNav activeKey={tab} onLocalTab={setTab} />
    </div>
  );
}
