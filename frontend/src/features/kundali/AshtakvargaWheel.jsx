const SIZE = 280,
  CX = SIZE / 2,
  CY = SIZE / 2;
const R_OUTER = 130,
  R_INNER = 50;

const polar = (a, r) => {
  const t = ((a - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(t), y: CY + r * Math.sin(t) };
};

function sector(start, end, rO, rI) {
  const s1 = polar(start, rO),
    e1 = polar(end, rO);
  const s2 = polar(end, rI),
    e2 = polar(start, rI);
  return `M ${s1.x} ${s1.y} A ${rO} ${rO} 0 0 1 ${e1.x} ${e1.y} L ${s2.x} ${s2.y} A ${rI} ${rI} 0 0 0 ${e2.x} ${e2.y} Z`;
}

function fillFor(total) {
  if (total >= 32) return "#4ade80";
  if (total >= 28) return "#c084fc";
  if (total >= 22) return "#fbbf24";
  return "#f87171";
}

export default function AshtakvargaWheel({ ashtakvarga }) {
  if (!ashtakvarga?.perSign) return null;
  const slice = 360 / 12;
  const total = ashtakvarga.sarva.reduce((a, b) => a + b, 0);
  const lucky = ashtakvarga.perSign.filter((s) => s.lucky).length;

  return (
    <div className="cosmic-card">
      <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px", color: "#fff" }}>Ashtakvarga (Sarva)</p>
      <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 12px" }}>
        Total Bindus per sign · max 56 · 28+ counts as fortunate ({lucky}/12 lucky · sum {total})
      </p>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {ashtakvarga.perSign.map((s, i) => {
            const a0 = i * slice,
              a1 = (i + 1) * slice;
            const norm = Math.max(0, Math.min(1, (s.total - 16) / 40));
            const rOut = R_INNER + 22 + norm * (R_OUTER - R_INNER - 22);
            const mid = polar((a0 + a1) / 2, rOut + 10);
            const inner = polar((a0 + a1) / 2, R_INNER + (rOut - R_INNER) / 2);
            return (
              <g key={s.sign}>
                <path
                  d={sector(a0, a1, rOut, R_INNER)}
                  fill={fillFor(s.total)}
                  opacity={0.75}
                  stroke="#050508"
                  strokeWidth={1}
                />
                <text x={mid.x} y={mid.y + 3} fontSize="9" fill="#cbd5e1" textAnchor="middle">
                  {s.sign.slice(0, 3)}
                </text>
                <text
                  x={inner.x}
                  y={inner.y + 3}
                  fontSize="11"
                  fontWeight="700"
                  fill="#fff"
                  textAnchor="middle"
                >
                  {s.total}
                </text>
              </g>
            );
          })}
          <circle cx={CX} cy={CY} r={R_INNER} fill="#0f0f18" stroke="rgba(255,255,255,0.08)" />
          <text x={CX} y={CY - 4} fontSize="10" fill="#64748b" textAnchor="middle">
            SARVA
          </text>
          <text x={CX} y={CY + 12} fontSize="14" fontWeight="700" fill="#fff" textAnchor="middle">
            {total}/337
          </text>
        </svg>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: 12 }}>
        {[
          ["32+ Excellent", "#4ade80"],
          ["28–31 Lucky", "#c084fc"],
          ["22–27 Mixed", "#fbbf24"],
          ["≤21 Weak", "#f87171"],
        ].map(([label, color]) => (
          <span
            key={label}
            style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "#cbd5e1" }}
          >
            <span style={{ width: 10, height: 10, borderRadius: 9999, background: color }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
