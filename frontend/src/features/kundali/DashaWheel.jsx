import { fmtDate } from "@/shared/astrology";
import { planetEnglish } from "@/shared/planetText";
import Card from "@/common/Card";

const SIZE = 240,
  CX = SIZE / 2,
  CY = SIZE / 2;
const RING_OUTER = 110,
  RING_INNER = 72,
  ARC_INNER = 62;

const polar = (a, r) => {
  const t = ((a - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(t), y: CY + r * Math.sin(t) };
};

function arc(start, end, rO, rI) {
  const s1 = polar(start, rO),
    e1 = polar(end, rO);
  const s2 = polar(end, rI),
    e2 = polar(start, rI);
  const large = end - start > 180 ? 1 : 0;
  return `M ${s1.x} ${s1.y} A ${rO} ${rO} 0 ${large} 1 ${e1.x} ${e1.y} L ${s2.x} ${s2.y} A ${rI} ${rI} 0 ${large} 0 ${e2.x} ${e2.y} Z`;
}

export default function DashaWheel({ chart }) {
  if (!chart?.curMaha) return null;
  const m = chart.curMaha,
    a = chart.curAntar,
    now = Date.now();
  const mPct = Math.max(0, Math.min(100, ((now - +m.start) / (+m.end - +m.start)) * 100));
  const aPct = a ? Math.max(0, Math.min(100, ((now - +a.start) / (+a.end - +a.start)) * 100)) : 0;

  return (
    <Card>
      <p className="m-0 mb-1 text-sm font-semibold text-ink">Planetary Period Timeline</p>
      <p className="m-0 mb-3 text-[11px] text-muted">Outer ring = Major Period. Inner ring = Sub-Period.</p>
      <div className="flex justify-center">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <circle
            cx={CX}
            cy={CY}
            r={(RING_OUTER + RING_INNER) / 2}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={RING_OUTER - RING_INNER}
            fill="none"
          />
          <circle
            cx={CX}
            cy={CY}
            r={(RING_INNER + ARC_INNER) / 2}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={RING_INNER - ARC_INNER}
            fill="none"
          />
          <path d={arc(0, (mPct / 100) * 360, RING_OUTER, RING_INNER)} fill="#a855f7" opacity={0.85} />
          <path d={arc(0, (aPct / 100) * 360, RING_INNER, ARC_INNER)} fill="#6366f1" opacity={0.85} />
          <text x={CX} y={CY - 8} fontSize="11" fill="#64748b" textAnchor="middle">
            CURRENT
          </text>
          <text x={CX} y={CY + 10} fontSize="18" fontWeight="700" fill="#fff" textAnchor="middle">
            {planetEnglish(m.lord)}
          </text>
          {a && (
            <text x={CX} y={CY + 28} fontSize="11" fill="#c084fc" textAnchor="middle">
              / {planetEnglish(a.lord)}
            </text>
          )}
        </svg>
      </div>
      <div className="mt-3 flex justify-center gap-5">
        <span className={legend}>
          <span className="h-3 w-3 rounded-full bg-[#a855f7]" /> Major Period · {Math.round(mPct)}%
        </span>
        {a && (
          <span className={legend}>
            <span className="h-3 w-3 rounded-full bg-accent" /> Sub-Period · {Math.round(aPct)}%
          </span>
        )}
      </div>
      <div className="mt-2.5 text-center">
        <p className="m-0 text-[11px] text-muted">
          {fmtDate(m.start)} – {fmtDate(m.end)}
        </p>
        {a && (
          <p className="m-0 text-[11px] text-muted">
            Sub-Period: {fmtDate(a.start)} – {fmtDate(a.end)}
          </p>
        )}
      </div>
    </Card>
  );
}

const legend = "flex items-center gap-1.5 text-[11.5px] font-semibold text-subtle";
