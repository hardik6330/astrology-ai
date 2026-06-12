import { useState } from "react";
import { signOf, ZE, fmtDate } from "@/shared/astrology";
import PlanetaryStrengthCard from "@/features/kundali/PlanetaryStrengthCard";
import Card from "@/common/Card";
import { planetInfoFor } from "./planetInfo";
import PlanetDetailModal from "./PlanetDetailModal";

// Planets tab: strength meter, the full planetary-position table, and the
// Vimshottari dasha timeline with progress bars. `now` is the page's frozen
// "current instant" so dasha progress is stable across re-renders.
export default function PlanetsTab({ chart, now }) {
  // Tapped planet → opens the detail modal. null = closed.
  const [selected, setSelected] = useState(null);
  return (
    <>
      {/* Planetary Strength meter */}
      <PlanetaryStrengthCard strengths={chart.strengths} />

      {/* Planet table */}
      <Card>
        <p className="m-0 mb-0.5 flex items-center gap-2 text-sm font-semibold text-ink">
          Planetary Positions
        </p>
        <p className="mx-0 mt-0 mb-4 text-[10.5px] text-muted">
          Whole-sign house system — tap any planet to learn what it means for you.
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
        {chart.planets.map((p) => {
          const tappable = !!planetInfoFor(p);
          return (
            <div
              key={p.name}
              onClick={() => tappable && setSelected(p)}
              className="planet-row group"
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1.5fr 1.5fr 0.6fr",
                fontSize: 13,
                padding: "10px 8px",
                margin: "0 -8px",
                borderRadius: 8,
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                alignItems: "center",
                cursor: tappable ? "pointer" : "default",
                transition: "background 0.15s ease",
              }}
              onMouseEnter={(e) => tappable && (e.currentTarget.style.background = "rgba(168,85,247,0.08)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ color: "#aaa", fontWeight: 500 }}>
                {p.name}
                {p.retro && <span style={{ color: "#f87171", fontSize: 11, marginLeft: 4 }}>℞</span>}
                {tappable && <span style={{ color: "#a855f7", fontSize: 12, marginLeft: 5 }}>›</span>}
              </span>
              <span style={{ color: "#ddd" }}>
                {ZE[signOf(p.sid)]} {signOf(p.sid)}
              </span>
              <span style={{ color: "#ddd" }}>
                {ZE[signOf(p.trop)]} {signOf(p.trop)}
              </span>
              <span style={{ color: "#888", textAlign: "center" }}>{p.houseSid}</span>
            </div>
          );
        })}
      </Card>

      {/* Vimshottari Dasha */}
      <Card>
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
            {chart.curAntar && <span style={{ color: "#a855f7" }}> · {chart.curAntar.lord} Antardasha</span>}
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
      </Card>

      <PlanetDetailModal planet={selected} onClose={() => setSelected(null)} />
    </>
  );
}
