import { useNavigate } from "react-router-dom";
import React, { useState } from "react";
import Card from "@/common/Card";
import { SIGNS, ZE, nm } from "@/shared/astrology";
import { STRINGS } from "@/shared/uiStrings";

// Bi-Wheel Chart (Birth vs Live Sky) — web twin of mobile GocharMap.js.
// A sidereal zodiac wheel with TWO planet rings over the same signs:
//   • inner ring  = NATAL planets (chart.planets, by sidereal longitude) — small
//                   solid dots, fixed at birth.
//   • outer ring  = LIVE transits (chart.transits.gochar) — outlined glyphs with
//                   a pulsing halo, moving in the sky now.
// A dashed line connects a live planet to a birth planet when they're within ~7°
// (a transit conjunction — e.g. live Saturn over birth Moon = Sade Sati). Both
// datasets are already computed client-side, so this needs no API call.
// Keep visuals/logic in sync with the mobile twin.

const SIZE = 300;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_OUTER = 142; // sign ring outer edge
const R_SIGN = 124; // sign glyph radius
const R_TRANSIT = 110; // LIVE planet ring (outer)
const R_NATAL = 72; // NATAL planet ring (inner)
const R_HUB = 44; // inner hub edge (sign dividers stop here)
const CONJ_ORB = 7; // degrees within which a transit "conjuncts" a natal planet

const GLYPH = {
  Sun: "☉",
  Moon: "☾",
  Mars: "♂",
  Mercury: "☿",
  Jupiter: "♃",
  Venus: "♀",
  Saturn: "♄",
  Rahu: "☊",
  Ketu: "☋",
};
const MALEFIC = new Set(["Sun", "Mars", "Saturn", "Rahu", "Ketu"]);

// palette (matches the other web wheels)
const C = {
  warning: "#fbbf24",
  success: "#4ade80",
  danger: "#f87171",
  textBody: "#cbd5e1",
  textMuted: "#64748b",
  primaryLight: "#a5b4fc",
  cardBorder: "rgba(255,255,255,0.08)",
  bg: "#0f0f18",
};

// Longitude (0°=Aries) → screen point. -90 puts 0° at the top; angles increase
// clockwise like a standard chart.
function polar(lon, r) {
  const a = ((lon - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
}

// Stagger glyphs that sit close together so they don't overlap: each is pushed
// toward the hub by how many earlier planets fall within 11° of it.
function stagger(list, baseR, step) {
  const sorted = [...list].sort((a, b) => a.lon - b.lon);
  return sorted.map((p, i) => {
    let crowd = 0;
    for (let j = 0; j < i; j++) {
      const d = Math.abs(sorted[j].lon - p.lon);
      if (Math.min(d, 360 - d) < 11) crowd++;
    }
    return { ...p, r: baseR - crowd * step };
  });
}

export default function GocharMap({ chart }) {
  const navigate = useNavigate();
  const [asked, setAsked] = useState(() => {
    try {
      const stored = localStorage.getItem("asked_alignments");
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      console.error("Failed to load asked alignments", e);
      return {};
    }
  });

  const markAsAsked = (key) => {
    const next = { ...asked, [key]: true };
    setAsked(next);
    try {
      localStorage.setItem("asked_alignments", JSON.stringify(next));
    } catch (e) {
      console.error("Failed to save asked alignments", e);
    }
  };

  const gochar = chart?.transits?.gochar;
  if (!Array.isArray(gochar) || !gochar.length) return null;

  const ascLon = nm(chart.angles?.ascSid ?? 0);

  const natalRaw = (chart.planets || [])
    .map((p) => ({ name: p.base || String(p.name || "").split(" ")[0], lon: nm(p.sid), retro: p.retro }))
    .filter((p) => GLYPH[p.name]);

  const liveP = stagger(
    gochar.map((p) => ({ ...p, lon: nm(p.lon) })),
    R_TRANSIT,
    17
  );
  const natalP = stagger(natalRaw, R_NATAL, 14);

  // Transit↔natal conjunctions (within orb) → dashed connectors + a list.
  const conjunctions = [];
  liveP.forEach((t) => {
    natalP.forEach((n) => {
      let d = Math.abs(t.lon - n.lon);
      d = Math.min(d, 360 - d);
      if (d <= CONJ_ORB) conjunctions.push({ t, n, orb: Math.round(d) });
    });
  });

  return (
    <Card>
      <p style={{ fontSize: 14, fontWeight: 700, margin: "0 0 4px", color: "#fff" }}>{STRINGS.CHART.TITLE}</p>
      <p style={{ fontSize: 11, color: C.textMuted, margin: "0 0 12px", lineHeight: 1.45 }}>
        {STRINGS.CHART.SUBTITLE}
      </p>

      <div style={{ display: "flex", justifyContent: "center", marginTop: 6 }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {/* Rings */}
          <circle cx={CX} cy={CY} r={R_OUTER} stroke={C.cardBorder} strokeWidth={1.5} fill="none" />
          <circle
            cx={CX}
            cy={CY}
            r={(R_TRANSIT + R_NATAL) / 2}
            stroke={C.cardBorder}
            strokeWidth={1.2}
            fill="none"
            opacity={0.8}
          />
          <circle cx={CX} cy={CY} r={R_HUB} stroke={C.cardBorder} strokeWidth={1.5} fill="none" />

          {/* 12 sign sectors: dividers + glyphs */}
          {SIGNS.map((sign, i) => {
            const boundary = i * 30;
            const o = polar(boundary, R_OUTER);
            const inn = polar(boundary, R_HUB);
            const g = polar(i * 30 + 15, R_SIGN);
            const isLagnaSign = Math.floor(ascLon / 30) === i;
            return (
              <g key={sign}>
                <line x1={inn.x} y1={inn.y} x2={o.x} y2={o.y} stroke={C.cardBorder} strokeWidth={1.5} />
                <text
                  x={g.x}
                  y={g.y + 6}
                  fontSize="20"
                  textAnchor="middle"
                  fill={isLagnaSign ? C.primaryLight : C.textMain}
                  fontWeight={900}
                  opacity={1}
                >
                  {ZE[sign]}
                </text>
              </g>
            );
          })}

          {/* Conjunction connectors (drawn under the glyphs). */}
          {conjunctions.map(({ t, n }, i) => {
            const a = polar(n.lon, n.r);
            const b = polar(t.lon, t.r);
            return (
              <line
                key={`c-${i}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={C.warning}
                strokeWidth={1.2}
                strokeDasharray="3,3"
                opacity={0.8}
              />
            );
          })}

          {/* Natal lagna (ascendant) marker — a tick + ASC label at the rim. */}
          {(() => {
            const tip = polar(ascLon, R_OUTER + 7);
            const base = polar(ascLon, R_OUTER - 6);
            const lbl = polar(ascLon, R_OUTER + 18);
            return (
              <g>
                <line
                  x1={base.x}
                  y1={base.y}
                  x2={tip.x}
                  y2={tip.y}
                  stroke={C.primaryLight}
                  strokeWidth={2.5}
                />
                <text
                  x={lbl.x}
                  y={lbl.y + 4}
                  fontSize="9"
                  fontWeight="700"
                  fill={C.primaryLight}
                  textAnchor="middle"
                >
                  ASC
                </text>
              </g>
            );
          })()}

          {/* NATAL planets (inner) — small solid dots, fixed at birth. */}
          {natalP.map((p) => {
            const pt = polar(p.lon, p.r);
            const tint = MALEFIC.has(p.name) ? C.danger : C.success;
            return (
              <g key={`n-${p.name}`}>
                <circle cx={pt.x} cy={pt.y} r={8.5} fill={tint} opacity={0.92} />
                <text
                  x={pt.x}
                  y={pt.y + 3.5}
                  fontSize="10"
                  fontWeight="800"
                  fill="#0b0a1f"
                  textAnchor="middle"
                >
                  {GLYPH[p.name] || p.name[0]}
                </text>
              </g>
            );
          })}

          {/* LIVE transits (outer) — pulsing halo + outlined glyph. */}
          {liveP.map((p) => {
            const pt = polar(p.lon, p.r);
            const tint = MALEFIC.has(p.name) ? C.danger : C.success;
            return (
              <g key={`t-${p.name}`}>
                <circle cx={pt.x} cy={pt.y} r={16} fill={tint}>
                  {/* SMIL pulse — no JS/extra deps needed in the browser. */}
                  <animate
                    attributeName="fill-opacity"
                    values="0.16;0.42;0.16"
                    dur="1.3s"
                    repeatCount="indefinite"
                  />
                </circle>
                <circle cx={pt.x} cy={pt.y} r={11} fill={C.bg} stroke={tint} strokeWidth={1.5} />
                <text x={pt.x} y={pt.y + 5} fontSize="13" fontWeight="700" fill={tint} textAnchor="middle">
                  {GLYPH[p.name] || p.name[0]}
                </text>
              </g>
            );
          })}

          {/* Hub label */}
          <text x={CX} y={CY - 4} fontSize="9" fill={C.textMuted} textAnchor="middle">
            {STRINGS.CHART.RISING}
          </text>
          <text x={CX} y={CY + 11} fontSize="12" fontWeight="700" fill="#fff" textAnchor="middle">
            {chart.transits.ascSign || ""}
          </text>
        </svg>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 12, flexWrap: "wrap" }}>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11.5,
            color: C.textBody,
            fontWeight: 600,
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: 5, background: C.textBody }} />{" "}
          {STRINGS.CHART.NATAL_LABEL} (inner)
        </span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11.5,
            color: C.textBody,
            fontWeight: 600,
          }}
        >
          <span style={{ width: 11, height: 11, borderRadius: 6, border: `2px solid ${C.textBody}` }} />{" "}
          {STRINGS.CHART.TRANSIT_LABEL} (outer)
        </span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11.5,
            color: C.textBody,
            fontWeight: 600,
          }}
        >
          <span style={{ width: 14, height: 2, background: C.warning }} /> Alignment
        </span>
      </div>

      {/* Active alignments — transit-over-natal conjunctions, each with an Ask
          button that deep-links to chat and auto-asks that exact question. */}
      {conjunctions.length > 0 && (
        <div
          style={{
            marginTop: 12,
            border: "1px solid rgba(251,191,36,0.25)",
            background: "rgba(251,191,36,0.06)",
            borderRadius: 12,
            padding: 12,
          }}
        >
          <p
            style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.5, color: C.warning, margin: "0 0 6px" }}
          >
            {STRINGS.CHART.CONJUNCTION_TITLE}
          </p>
          {conjunctions.map(({ t, n, orb }, i) => {
            const key = `${t.name}-${n.name}`;
            const isAsked = asked[key];
            const question =
              `Right now transiting ${t.name} is conjunct my natal ${n.name} ` +
              `(within ${orb}°). What does this alignment mean for me, and what should I focus on?`;

            const onAsk = () => {
              markAsAsked(key);
              navigate("/chat", { state: { ask: question } });
            };

            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <span style={{ flex: 1, fontSize: 12.5, lineHeight: 1.5 }}>
                  <span style={{ color: C.warning, fontWeight: 800 }}>
                    {GLYPH[t.name]} {STRINGS.CHART.TRANSIT_LABEL}ing {t.name}
                  </span>
                  {"  ≈  "}
                  <span style={{ color: C.textBody, fontWeight: 700 }}>
                    {GLYPH[n.name]} {STRINGS.CHART.NATAL_LABEL} {n.name}
                  </span>
                  <span style={{ color: C.textMuted, fontSize: 11 }}> · {orb}° orb</span>
                </span>
                <button
                  onClick={onAsk}
                  disabled={isAsked}
                  style={{
                    cursor: isAsked ? "default" : "pointer",
                    border: `1px solid ${isAsked ? C.textMuted : C.warning}`,
                    background: isAsked ? "rgba(255,255,255,0.04)" : "rgba(251,191,36,0.14)",
                    borderRadius: 9999,
                    padding: "4px 11px",
                    color: isAsked ? C.textMuted : C.warning,
                    fontSize: 11.5,
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                    opacity: isAsked ? 0.6 : 1,
                  }}
                >
                  {isAsked ? STRINGS.ACTIONS.ANALYZED : STRINGS.ACTIONS.INTERPRET + " ›"}
                </button>
              </div>
            );
          })}
          <p style={{ fontSize: 10.5, color: C.textMuted, margin: "3px 0 0", lineHeight: 1.4 }}>
            {STRINGS.CHART.CONJUNCTION_FOOTNOTE}
          </p>
        </div>
      )}

      {/* Impact list — each transit → the house it activates from your lagna. */}
      <div style={{ marginTop: 12, borderTop: `1px solid ${C.cardBorder}`, paddingTop: 12 }}>
        {gochar.map((p) => (
          <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
            <span
              style={{
                width: 16,
                fontSize: 14,
                fontWeight: 700,
                textAlign: "center",
                color: MALEFIC.has(p.name) ? C.danger : C.success,
              }}
            >
              {GLYPH[p.name] || ""}
            </span>
            <span style={{ width: 64, color: C.textBody, fontSize: 12.5, fontWeight: 600 }}>
              {p.name}
              {p.retro ? " ℞" : ""}
            </span>
            <span style={{ flex: 1, color: "#fff", fontSize: 12.5 }}>
              {ZE[p.sign]} {p.sign} {p.deg}°
            </span>
            <span
              style={{
                color: C.textMuted,
                fontSize: 11,
                fontWeight: 700,
                background: "rgba(255,255,255,0.04)",
                borderRadius: 5,
                padding: "2px 7px",
              }}
            >
              H{p.houseLagna}
            </span>
          </div>
        ))}
        <p style={{ fontSize: 10.5, color: C.textMuted, margin: "4px 0 0" }}>
          House counted from your {STRINGS.CHART.ASCENDANT.toLowerCase()} ({chart.transits.ascSign}).
        </p>
      </div>
    </Card>
  );
}
