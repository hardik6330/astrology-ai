// Lightweight, dependency-free SVG charts for the admin dashboard. We hand-roll
// these (rather than pull in recharts/chart.js) to match the codebase's custom-
// SVG convention and keep the admin bundle small. Two primitives:
//   <TrendChart>  — area + line for a daily time-series (signups, revenue, …)
//   <Donut>       — ring breakdown for a small categorical split (status, …)
// Both inherit the app's violet palette and are reduced-motion-safe.

import { useState } from "react";

// Uniformly-scaled viewBox: the SVG stretches to its container width, height
// follows the aspect ratio, so strokes never distort. Hover maps the pointer's
// horizontal fraction → nearest data index (linear, scale-independent).
const W = 640;
const H = 220;
const PAD = { l: 16, r: 16, t: 18, b: 26 };

// Compact INR / integer formatting for axis + tooltip labels.
export const fmtInr = (paise) => `₹${Math.round((paise || 0) / 100).toLocaleString("en-IN")}`;
export const fmtInt = (n) => (n || 0).toLocaleString("en-IN");
// "Jun 23" from a YYYY-MM-DD key (parsed as UTC to match the backend buckets).
const fmtDay = (key) =>
  new Date(`${key}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

export function TrendChart({ labels = [], data = [], color = "#8b5cf6", format = fmtInt, gid = "c" }) {
  const [hover, setHover] = useState(null);
  const n = data.length;

  if (!n) return <div className="grid h-40 place-items-center text-[13px] text-dim">No data yet</div>;

  const max = Math.max(1, ...data);
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const x = (i) => PAD.l + (n === 1 ? innerW / 2 : (i * innerW) / (n - 1));
  const y = (v) => PAD.t + innerH * (1 - v / max);

  const pts = data.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const area = `${PAD.l},${y(0)} ${pts} ${x(n - 1)},${y(0)}`;
  const total = data.reduce((a, b) => a + b, 0);

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - r.left) / r.width;
    setHover(Math.max(0, Math.min(n - 1, Math.round(frac * (n - 1)))));
  };

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        role="img"
      >
        <defs>
          <linearGradient id={`grad-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.32" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* faint horizontal gridlines (0 / 50% / 100% of max) */}
        {[0, 0.5, 1].map((g) => (
          <line
            key={g}
            x1={PAD.l}
            x2={W - PAD.r}
            y1={y(max * g)}
            y2={y(max * g)}
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="1"
          />
        ))}

        <polygon points={area} fill={`url(#grad-${gid})`} />
        <polyline
          points={pts}
          fill="none"
          stroke={color}
          strokeWidth="2.2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {hover != null && (
          <>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.t}
              y2={y(0)}
              stroke={color}
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.6"
            />
            <circle cx={x(hover)} cy={y(data[hover])} r="4" fill={color} stroke="#0b0b16" strokeWidth="2" />
          </>
        )}
      </svg>

      {/* tooltip — HTML overlay positioned by the hovered point's % offset */}
      {hover != null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg border border-white/12 bg-[#12121f]/95 px-2.5 py-1.5 text-center shadow-xl backdrop-blur-md"
          style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(data[hover]) / H) * 100}%` }}
        >
          <div className="text-[11px] font-bold text-ink">{format(data[hover])}</div>
          <div className="text-[10px] text-dim">{fmtDay(labels[hover])}</div>
        </div>
      )}

      {/* x-axis end labels + running total */}
      <div className="mt-1 flex items-center justify-between text-[11px] text-dim">
        <span>{labels[0] ? fmtDay(labels[0]) : ""}</span>
        <span className="text-subtle">Total {format(total)}</span>
        <span>{labels[n - 1] ? fmtDay(labels[n - 1]) : ""}</span>
      </div>
    </div>
  );
}

export function Donut({ data = [], format = fmtInt, size = 150 }) {
  const slices = data.filter((d) => d.value > 0);
  const total = slices.reduce((a, d) => a + d.value, 0);
  const r = 56;
  const C = 2 * Math.PI * r;

  if (!total) return <div className="grid h-37.5 place-items-center text-[13px] text-dim">No data yet</div>;

  let acc = 0;
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 150 150" width={size} height={size} className="shrink-0">
        {/* arcs are rotated -90° (start at 12 o'clock); text stays upright */}
        <g transform="rotate(-90 75 75)">
          <circle cx="75" cy="75" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" />
          {slices.map((d) => {
            const seg = (d.value / total) * C;
            const el = (
              <circle
                key={d.label}
                cx="75"
                cy="75"
                r={r}
                fill="none"
                stroke={d.color}
                strokeWidth="14"
                strokeDasharray={`${seg} ${C - seg}`}
                strokeDashoffset={-acc}
                strokeLinecap="butt"
              />
            );
            acc += seg;
            return el;
          })}
        </g>
        <text x="75" y="82" textAnchor="middle" fill="#e7e7f0" fontSize="22" fontWeight="700">
          {fmtInt(total)}
        </text>
      </svg>

      <ul className="m-0 list-none space-y-2 p-0">
        {slices.map((d) => (
          <li key={d.label} className="flex items-center gap-2 text-[13px]">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
            <span className="text-body capitalize">{d.label}</span>
            <span className="ml-auto pl-3 font-semibold text-ink">{format(d.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
