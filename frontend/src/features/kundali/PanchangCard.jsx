// Five vedic time-elements at the moment of birth.

export default function PanchangCard({ panchang }) {
  if (!panchang) return null;
  const items = [
    ["Tithi", panchang.tithi],
    ["Nakshatra", `${panchang.nakshatra} · Pada ${panchang.pada}`],
    ["Yoga", panchang.yoga],
    ["Karana", panchang.karana],
    ["Vaara", panchang.vaara],
  ];

  return (
    <div className="cosmic-card">
      <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px", color: "#fff" }}>Panchang Snapshot</p>
      <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 12px" }}>
        Five vedic time-elements at the moment of birth.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
        {items.map(([k, v]) => (
          <div
            key={k}
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              padding: "10px 12px",
            }}
          >
            <p
              style={{
                fontSize: 10,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: 1,
                margin: 0,
              }}
            >
              {k}
            </p>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: "3px 0 0" }}>{v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
