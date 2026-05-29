import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { computeChart } from "../astrology";
import { useChart } from "../context/ChartContext";
import CitySearch from "../components/CitySearch";

const lbl = { fontSize: 13, color: "#888", display: "block", marginBottom: 4 };

// Landing page — the birth-detail form. On submit it computes the chart
// and routes to the protected /reading page.
export default function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { form, setForm, chart, setChart, setInterp, setDaily, setChatMsgs } = useChart();
  const [error, setError] = useState("");

  // Returning user: if ChartContext already has a chart, skip the form and
  // land on Reading. Suppressed when the user explicitly came here to edit
  // (e.g. "New Reading" / "Update Birth Details" pass `state.edit = true`).
  const editMode = !!location.state?.edit;
  useEffect(() => {
    if (chart && !editMode) navigate("/reading", { replace: true });
  }, [chart, editMode, navigate]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Today in local YYYY-MM-DD — used as the <input type=date> max attribute
  // and the defensive check below. Built locally (not via toISOString) so
  // users near midnight in non-UTC zones don't see "tomorrow" disallowed.
  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  // Seconds-since-epoch at the user's local birth instant — passed to the
  // Time Zone API so the offset returned is correct for the birth date
  // (handles historical DST rule changes). Only valid once both date & time
  // are filled; until then we omit it and Google returns "current" offset.
  const birthTimestamp = (() => {
    if (!form.date || !form.time) return null;
    const [y, m, d] = form.date.split("-").map(Number);
    const [hh, mm] = form.time.split(":").map(Number);
    return Math.floor(Date.UTC(y, m - 1, d, hh || 0, mm || 0) / 1000);
  })();

  function onCitySelected(picked, errMsg) {
    if (errMsg) {
      setError(errMsg);
      return;
    }
    if (!picked) return;
    setError("");
    setForm((f) => ({
      ...f,
      city: picked.city,
      lat: picked.lat,
      lon: picked.lon,
      tz: picked.tz,
      tzId: picked.tzId,
      placeId: picked.placeId,
    }));
  }

  function generate() {
    if (!form.date || !form.time || !form.city) {
      setError("All fields are required!");
      return;
    }
    if (form.date > today) {
      setError("Birth date can't be in the future.");
      return;
    }
    if (form.lat == null || form.lon == null || form.tz == null) {
      setError("Please pick your city from the suggestions.");
      return;
    }
    setError("");
    try {
      const ch = computeChart(form.date, form.time, {
        n: form.city,
        lat: form.lat,
        lon: form.lon,
        tz: form.tz,
      });
      setChart(ch);
      setInterp(null);
      setDaily(null);
      setChatMsgs([]);
      // Funnel through the optional palm-reading step before kundali.
      navigate("/palm-step");
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1rem", position: "relative" }}>
      <div className="cosmos"></div>
      <div className="stars"></div>

      <div className="cosmic-card" style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <h2
          style={{
            fontSize: 28,
            fontWeight: 700,
            margin: "0 0 8px",
            background: "linear-gradient(to right, #fff, #a855f7)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          ✨ AI Kundali Insights ✨
        </h2>
        <p style={{ fontSize: 14, color: "#aaa", margin: 0, letterSpacing: "0.5px" }}>
          Precision Astronomy + Celestial Intelligence
        </p>
      </div>

      <div className="cosmic-card">
        <div style={{ display: "grid", gap: 16 }}>
          <div className="grid-name-gender">
            <div>
              <label style={lbl}>Full Name</label>
              <input
                className="premium-input"
                placeholder="Enter your name..."
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>
            <div>
              <label style={lbl}>Gender</label>
              <select
                className="premium-input"
                value={form.gender}
                onChange={(e) => set("gender", e.target.value)}
              >
                <option value="">— optional —</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div>
              <label style={lbl}>Birth Date</label>
              <input
                type="date"
                className="premium-input"
                value={form.date}
                max={today}
                onChange={(e) => set("date", e.target.value)}
              />
            </div>
            <div>
              <label style={lbl}>Birth Time</label>
              <input
                type="time"
                className="premium-input"
                value={form.time}
                onChange={(e) => set("time", e.target.value)}
              />
            </div>
          </div>
          <div>
            <label style={lbl}>Birth City</label>
            <CitySearch value={form.city} birthTimestamp={birthTimestamp} onSelect={onCitySelected} />
          </div>
          <button onClick={generate} className="magic-btn" style={{ marginTop: 8, width: "100%" }}>
            Reveal My Destiny ↗
          </button>
        </div>
      </div>

      {error && (
        <div className="cosmic-card" style={{ borderColor: "#ef4444", background: "rgba(239, 68, 68, 0.1)" }}>
          <p style={{ color: "#f87171", fontSize: 14, margin: 0 }}>⚠️ {error}</p>
        </div>
      )}
    </div>
  );
}
