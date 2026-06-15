import { useState } from "react";
import { ZE, fmtDate, fmtDay } from "@/shared/astrology";
import DashaWheel from "@/features/kundali/DashaWheel";
import AshtakvargaWheel from "@/features/kundali/AshtakvargaWheel";
import GocharMap from "@/features/kundali/GocharMap";
import Card from "@/common/Card";
import { EMOJIS } from "@/utils/emojis";
import { periodEnglish } from "@/shared/planetText";
import { dashaGuidanceFor } from "./planetInfo";

// One forecast window — click to expand the reasoning (why) + behavioral Do's /
// Don'ts for that dasha lord. Guidance is static per planet (free). Web twin of
// the mobile ForecastItem; smooth max-height transition for a modern feel.
function ForecastItem({ p, tc }) {
  const [open, setOpen] = useState(false);
  const guide = dashaGuidanceFor(p.period);
  const why = Array.isArray(p.why) ? p.why : [];
  const expandable = why.length > 0 || !!guide;

  return (
    <div style={{ borderLeft: `2px solid ${tc}`, paddingLeft: 12, marginBottom: 14 }}>
      <div
        onClick={() => expandable && setOpen((v) => !v)}
        style={{ cursor: expandable ? "pointer" : "default" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "#e2e8f0" }}>
            {periodEnglish(p.period)}
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
        <p style={{ fontSize: 11.5, color: "#cbd5e1", margin: "0 0 7px", lineHeight: 1.55 }}>{p.summary}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 5, alignItems: "center" }}>
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
          {expandable && (
            <span style={{ fontSize: 10, color: tc, fontWeight: 700, marginLeft: "auto" }}>
              {open ? "Hide details ▲" : "Do's & Don'ts ▼"}
            </span>
          )}
        </div>
      </div>

      {/* Smooth reveal: animate max-height + opacity. */}
      <div
        style={{
          overflow: "hidden",
          transition: "max-height 0.35s ease, opacity 0.3s ease",
          maxHeight: open ? 600 : 0,
          opacity: open ? 1 : 0,
        }}
      >
        <div style={{ paddingTop: 8 }}>
          {why.length > 0 && (
            <>
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 1,
                  color: "#64748b",
                  margin: "0 0 4px",
                }}
              >
                WHY THIS PERIOD
              </p>
              {why.map((w, j) => (
                <p key={j} style={{ fontSize: 10.5, color: "#8b9bb0", margin: "3px 0" }}>
                  {EMOJIS.SPARKLES} {w}
                </p>
              ))}
            </>
          )}
          {guide && (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <div
                style={{
                  flex: 1,
                  border: "1px solid rgba(34,197,94,0.25)",
                  background: "rgba(34,197,94,0.06)",
                  borderRadius: 10,
                  padding: 9,
                }}
              >
                <p style={{ fontSize: 11.5, fontWeight: 800, color: "#4ade80", margin: "0 0 5px" }}>✓ Do</p>
                {guide.dos.map((d, j) => (
                  <p key={j} style={{ fontSize: 11, color: "#cbd5e1", margin: "0 0 2px", lineHeight: 1.45 }}>
                    • {d}
                  </p>
                ))}
              </div>
              <div
                style={{
                  flex: 1,
                  border: "1px solid rgba(248,113,113,0.25)",
                  background: "rgba(248,113,113,0.06)",
                  borderRadius: 10,
                  padding: 9,
                }}
              >
                <p style={{ fontSize: 11.5, fontWeight: 800, color: "#f87171", margin: "0 0 5px" }}>
                  ✕ Don&apos;t
                </p>
                {guide.donts.map((d, j) => (
                  <p key={j} style={{ fontSize: 11, color: "#cbd5e1", margin: "0 0 2px", lineHeight: 1.45 }}>
                    • {d}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Detailed breakdown of a person's dasha timeline, planetary transits, and
// confidence scores (how many chart signatures back each AI theme).
export default function TimelineTab({ chart }) {
  return (
    <>
      {/* Dasha Timeline Wheel */}
      <DashaWheel chart={chart} />

      {/* Ashtakvarga Wheel */}
      <AshtakvargaWheel ashtakvarga={chart.ashtakvarga} />

      {/* Bi-Wheel (Gochar) Map — real-time sky over the natal chart */}
      <GocharMap chart={chart} />

      {/* Timeline Forecast */}
      <Card>
        <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px", color: "#fff" }}>Timeline Forecast</p>
        <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 16px" }}>
          Upcoming period windows — click one for its Do&apos;s &amp; Don&apos;ts
        </p>
        {chart.predictions.map((p, i) => {
          const tc = p.tone === "supportive" ? "#4ade80" : p.tone === "testing" ? "#f87171" : "#fbbf24";
          return <ForecastItem key={i} p={p} tc={tc} />;
        })}
      </Card>

      {/* Confidence Scores */}
      <Card>
        <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 6px", color: "#fff" }}>Analysis Confidence</p>
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
      </Card>

      {/* Transits */}
      <Card>
        <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 16px", color: "#fff" }}>
          Current Sky (Transits)
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
              {EMOJIS.WARNING} Saturn Cycle Phase: {chart.transits.sadeSati.phase}
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
              ✓ Free from Saturn Cycle
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
              <span style={{ color: "#666", fontSize: 11, marginLeft: 6 }}>• {p.houseMoon}th from Moon</span>
            </span>
          </div>
        ))}
      </Card>
    </>
  );
}
