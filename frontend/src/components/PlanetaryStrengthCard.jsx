// 0–100 strength per planet, derived from dignity + house + motion.

function barColor(score) {
  if (score >= 75) return "#4ade80";
  if (score >= 50) return "#c084fc";
  if (score >= 30) return "#fbbf24";
  return "#f87171";
}

export default function PlanetaryStrengthCard({ strengths }) {
  if (!strengths?.length) return null;
  return (
    <div className="cosmic-card">
      <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px", color: "#fff" }}>Planetary Strength Meter</p>
      <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 12px" }}>
        Each planet rated 0–100 from dignity, house and motion.
      </p>
      {strengths.map((s) => {
        const col = barColor(s.score);
        return (
          <div key={s.planet} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 5 }}>
              <span style={{ color: "#cbd5e1", fontSize: 12.5, fontWeight: 600, width: 90 }}>
                {s.planet}{s.retro ? <span style={{ color: "#f87171", fontSize: 11 }}>  ℞</span> : null}
              </span>
              <span style={{ flex: 1, color: "#64748b", fontSize: 10.5 }}>
                {s.label}{s.house ? ` · H${s.house}` : ""}
              </span>
              <span style={{ color: col, fontSize: 12, fontWeight: 700 }}>{s.score}</span>
            </div>
            <div style={{ height: 7, background: "rgba(255,255,255,0.05)", borderRadius: 9999, overflow: "hidden" }}>
              <div style={{ width: `${s.score}%`, height: "100%", background: col, boxShadow: `0 0 10px ${col}44` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
