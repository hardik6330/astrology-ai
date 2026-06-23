// 0–100 strength per planet, derived from dignity + house + motion.

import Card from "@/common/Card";
function barColor(score) {
  if (score >= 75) return "#86efac"; // lightened from #4ade80
  if (score >= 50) return "#d8b4fe"; // lightened from #c084fc
  if (score >= 30) return "#fcd34d"; // lightened from #fbbf24
  return "#fca5a5"; // lightened from #f87171
}

export default function PlanetaryStrengthCard({ strengths }) {
  if (!strengths?.length) return null;
  return (
    <Card>
      <p className="m-0 mb-1 text-sm font-semibold text-ink">Planetary Strength Meter</p>
      <p className="m-0 mb-3 text-[11px] text-muted">
        Each planet rated 0–100 from dignity, house and motion.
      </p>
      {strengths.map((s) => {
        const col = barColor(s.score);
        return (
          <div key={s.planet} className="mb-3">
            <div className="mb-1.25 flex items-center">
              <span className="w-22.5 text-[12.5px] font-semibold text-subtle">
                {s.planet}
                {s.retro ? <span className="text-[11px] text-danger"> ℞</span> : null}
              </span>
              <span className="flex-1 text-[10.5px] text-muted">
                {s.label}
                {s.house ? ` · H${s.house}` : ""}
              </span>
              {/* Score color is data-driven → inline. */}
              <span className="text-xs font-bold" style={{ color: col }}>
                {s.score}
              </span>
            </div>
            <div className="h-1.75 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full"
                style={{ width: `${s.score}%`, background: col, boxShadow: `0 0 10px ${col}44` }}
              />
            </div>
          </div>
        );
      })}
    </Card>
  );
}
