// Landing-page hero visuals: the palm "analysis report" card and the rotating
// zodiac bi-wheel. Both are self-contained and decorative.
import { LuScan, LuListChecks, LuSparkles, LuArrowRight } from "react-icons/lu";
import { RASHI } from "./data";

// ── Rich Palm Analysis Preview: a high-fidelity "Result Card" that feels like a
// real product feature (replaces the abstract scan box).
export function PalmReportPreview() {
  const lines = [
    { label: "Heart Line", value: 88, color: "#f472b6", text: "Strong emotional depth" },
    { label: "Life Line", value: 92, color: "#22d3ee", text: "High vitality & rhythm" },
    { label: "Head Line", value: 76, color: "#a78bfa", text: "Analytical mindset" },
  ];

  return (
    <div className="relative w-full max-w-[420px]">
      {/* Background glow */}
      <div
        aria-hidden="true"
        className="absolute -inset-10 -z-10 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(139,92,246,0.35), transparent 70%)" }}
      />

      <div className="overflow-hidden rounded-3xl border border-white/12 bg-[#0b0b16]/90 p-1 shadow-2xl backdrop-blur-xl">
        {/* Card Header */}
        <div className="flex items-center gap-3 border-b border-white/10 px-6 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
            <LuScan size={20} />
          </div>
          <div>
            <div className="text-xs font-bold tracking-widest text-primary uppercase">Analysis Report</div>
            <div className="text-[10px] text-dim font-mono">ID: PX-8829-01</div>
          </div>
          <div className="ml-auto rounded-full bg-success/10 px-2.5 py-1 text-[10px] font-bold text-success">
            COMPLETE
          </div>
        </div>

        {/* Card Body */}
        <div className="space-y-6 px-6 py-6">
          {lines.map((line, i) => (
            <div key={line.label} className="chat-rise" style={{ animationDelay: `${i * 0.15}s` }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-ink">{line.label}</span>
                <span className="text-xs font-mono text-dim">{line.value}% Match</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${line.value}%`,
                    backgroundColor: line.color,
                    boxShadow: `0 0 10px ${line.color}80`,
                  }}
                />
              </div>
              <div className="mt-2 text-[11px] text-body flex items-center gap-1.5">
                <LuListChecks size={12} style={{ color: line.color }} />
                {line.text}
              </div>
            </div>
          ))}

          {/* Bottom Summary Chip */}
          <div
            className="chat-rise mt-4 rounded-2xl bg-white/[0.04] p-4 border border-white/5"
            style={{ animationDelay: "0.5s" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <LuSparkles size={14} className="text-warning" />
              <span className="text-xs font-bold text-ink">AI Insight</span>
            </div>
            <p className="text-[11px] leading-relaxed text-body">
              Your palm geometry indicates a strong balance between logical decision making and emotional
              intuition. The fate line suggests a significant career shift near age 32.
            </p>
          </div>
        </div>

        {/* Interactive Footer */}
        <div className="flex items-center justify-between border-t border-white/10 bg-white/[0.02] px-6 py-4">
          <div className="flex -space-x-2">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-6 w-6 rounded-full border-2 border-[#0b0b16] bg-primary/30 flex items-center justify-center"
              >
                <div className="h-1 w-1 rounded-full bg-white/50" />
              </div>
            ))}
          </div>
          <div className="text-[10px] text-dim">21 landmarks detected</div>
          <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center text-subtle">
            <LuArrowRight size={14} />
          </div>
        </div>
      </div>

      {/* Floating data badges */}
      <div className="absolute -right-4 top-20 chat-rise hidden md:block" style={{ animationDelay: "0.8s" }}>
        <div className="rounded-xl border border-white/10 bg-[#12121f]/90 p-3 shadow-xl backdrop-blur-md">
          <div className="text-[10px] font-bold text-dim uppercase tracking-tighter">Confidence</div>
          <div className="text-lg font-bold text-success">99.4%</div>
        </div>
      </div>
    </div>
  );
}

// ── Rotating zodiac bi-wheel (ported from the original hero motif). The whole
// wheel spins; each glyph counter-rotates so the signs orbit upright.
export function RashiWheel() {
  return (
    <svg
      viewBox="0 0 360 360"
      className="rashi-wheel w-[min(400px,82%)]"
      style={{ filter: "drop-shadow(0 0 30px rgba(139,92,246,0.35))" }}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(139,92,246,0.5)" />
          <stop offset="100%" stopColor="rgba(139,92,246,0)" />
        </radialGradient>
        <linearGradient id="wheelGrad" x1="180" y1="30" x2="180" y2="330" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="40%" stopColor="#c4b5fd" />
          <stop offset="100%" stopColor="#f9a8d4" />
        </linearGradient>
      </defs>

      <circle className="rashi-halo" cx="180" cy="180" r="150" fill="url(#halo)" />
      <circle
        cx="180"
        cy="180"
        r="150"
        fill="none"
        stroke="url(#wheelGrad)"
        strokeWidth="1.6"
        opacity="0.95"
      />
      <circle
        cx="180"
        cy="180"
        r="108"
        fill="none"
        stroke="url(#wheelGrad)"
        strokeWidth="1.2"
        opacity="0.8"
      />
      <circle cx="180" cy="180" r="60" fill="none" stroke="url(#wheelGrad)" strokeWidth="1" opacity="0.5" />

      {Array.from({ length: 12 }).map((_, i) => {
        const a = ((i * 30 - 90) * Math.PI) / 180;
        return (
          <line
            key={`spoke-${i}`}
            x1={180 + 60 * Math.cos(a)}
            y1={180 + 60 * Math.sin(a)}
            x2={180 + 150 * Math.cos(a)}
            y2={180 + 150 * Math.sin(a)}
            stroke="url(#wheelGrad)"
            strokeWidth="0.8"
            opacity="0.55"
          />
        );
      })}

      {RASHI.map((s, i) => {
        const a = ((i * 30 - 90 + 15) * Math.PI) / 180;
        const r = 129;
        return (
          <text
            key={`rashi-${i}`}
            className="rashi-glyph"
            x={180 + r * Math.cos(a)}
            y={180 + r * Math.sin(a)}
            fontSize="21"
            fontWeight="600"
            textAnchor="middle"
            dominantBaseline="central"
            fill="#fef3c7"
            style={{ filter: "drop-shadow(0 0 5px rgba(254,243,199,0.45))" }}
          >
            {s}
          </text>
        );
      })}

      <text x="180" y="180" fontSize="26" textAnchor="middle" dominantBaseline="central" fill="#fde68a">
        ✦︎
      </text>
    </svg>
  );
}
