import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { computeChart, CITIES } from "../astrology";
import { useChart } from "../context/ChartContext";

const lbl = { fontSize: 13, color: "#888", display: "block", marginBottom: 4 };

// Landing page — the birth-detail form. On submit it computes the chart
// and routes to the protected /reading page.
export default function HomePage() {
  const navigate = useNavigate();
  const { form, setForm, chart, setChart, setInterp, setDaily, setChatMsgs } = useChart();
  const [error, setError] = useState("");

  // Returning visitor: a chart already exists (rehydrated from sessionStorage
  // or applied right after login) — skip the form and land on Reading/kundali.
  if (chart && form?.date && form?.time && form?.city) {
    return <Navigate to="/reading" replace state={{ tab: "kundali" }} />;
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Today in local YYYY-MM-DD — used as the <input type=date> max attribute
  // and the defensive check below. Built locally (not via toISOString) so
  // users near midnight in non-UTC zones don't see "tomorrow" disallowed.
  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  function generate() {
    if (!form.date || !form.time || !form.city) { setError("All fields are required!"); return; }
    if (form.date > today) { setError("Birth date can't be in the future."); return; }
    setError("");
    const city = CITIES.find(c => c.n === form.city);
    try {
      const ch = computeChart(form.date, form.time, city);
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
        <h2 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 8px", background: "linear-gradient(to right, #fff, #a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
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
              <input className="premium-input" placeholder="Enter your name..." value={form.name} onChange={e => set("name", e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Gender</label>
              <select className="premium-input" value={form.gender} onChange={e => set("gender", e.target.value)}>
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
              <input type="date" className="premium-input" value={form.date} max={today} onChange={e => set("date", e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Birth Time</label>
              <input type="time" className="premium-input" value={form.time} onChange={e => set("time", e.target.value)} />
            </div>
          </div>
          <div>
            <label style={lbl}>Birth City</label>
            <select className="premium-input" value={form.city} onChange={e => set("city", e.target.value)}>
              <option value="">— Select your city —</option>
              {CITIES.map(c => <option key={c.n} value={c.n}>{c.n}</option>)}
            </select>
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
