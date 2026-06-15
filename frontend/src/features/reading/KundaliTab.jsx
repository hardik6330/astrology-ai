import { useState } from "react";
import { signOf, ZE } from "@/shared/astrology";
import KundaliChart from "@/features/kundali/KundaliChart";
import DoshaCard from "@/features/kundali/DoshaCard";
import PanchangCard from "@/features/kundali/PanchangCard";
import Card from "@/common/Card";
import { EMOJIS } from "@/utils/emojis";
import { STRINGS } from "@/shared/uiStrings";
import DailyInsightsCard from "./DailyInsightsCard";

// Birth Chart tab: Big Three + Nakshatra header, daily guidance, the
// celestial wheel, dosha/panchang snapshots, and the life-area score matrix.
export default function KundaliTab({ chart, form, onError }) {
  const [chartStyle, setChartStyle] = useState("north");

  const sunV = signOf(chart.planets[0].sid);
  const moonV = signOf(chart.planets[1].sid);
  const ascV = signOf(chart.angles.ascSid);

  return (
    <>
      <div className="grid-3" style={{ marginBottom: 20 }}>
        {[
          [STRINGS.LABELS.SUN_SIGN, sunV, EMOJIS.SUN],
          [STRINGS.LABELS.MOON_SIGN, moonV, EMOJIS.MOON],
          [STRINGS.LABELS.ASCENDANT, ascV, EMOJIS.ARROW_UP],
        ].map(([l, v, ic]) => (
          <div key={l} className="big-three-card">
            <span className="astrology-icon">{ic}</span>
            <p className="m-0 mb-1 text-[11px] text-[#888] uppercase">{l}</p>
            <p className="m-0 text-[15px] font-bold text-ink">
              {ZE[v] || ""} {v}
            </p>
          </div>
        ))}
      </div>

      <Card className="text-center" style={{ padding: "12px" }}>
        <p className="m-0 text-[13px] font-medium text-warning">
          {EMOJIS.MOON} {STRINGS.LABELS.BIRTH_STAR}:{" "}
          <span className="text-[15px] font-bold">{chart.nakshatra}</span>
        </p>
      </Card>

      {/* Daily Guidance */}
      <DailyInsightsCard chart={chart} form={form} onError={onError} />

      {/* Kundali chart wheel */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <p className="m-0 text-sm font-semibold text-ink">Celestial Wheel</p>
          <div className="flex gap-2">
            {[
              ["north", "North"],
              ["south", "South"],
            ].map(([v, l]) => (
              <button
                key={v}
                onClick={() => setChartStyle(v)}
                className={`cursor-pointer rounded-lg border px-3 py-1.5 text-[11px] text-inherit ${
                  chartStyle === v
                    ? "border-accent bg-[rgba(99,102,241,0.2)]"
                    : "border-[#444] bg-transparent"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <KundaliChart chart={chart} variant={chartStyle} />
        <p className="mt-3 text-center text-[10px] tracking-[0.5px] text-[#555]">
          Su:Sun • Mo:Moon • Ma:Mars • Me:Mercury • Ju:Jupiter • Ve:Venus • Sa:Saturn • Ra:Rahu • Ke:Ketu
        </p>
      </Card>

      {/* Dosha & Yoga Status */}
      <DoshaCard doshas={chart.doshas} />

      {/* Panchang Snapshot */}
      <PanchangCard panchang={chart.panchang} />

      {/* Life-area scores */}
      <Card>
        <p className="m-0 mb-4 text-sm font-semibold text-ink">Destiny Matrix</p>
        {chart.scores.map((s) => {
          const col = s.score >= 70 ? "#4ade80" : s.score >= 45 ? "#fbbf24" : "#f87171";
          return (
            <details key={s.key} className="mb-3.5">
              <summary className="cursor-pointer list-none">
                <div className="mb-1.5 flex justify-between text-xs">
                  <span className="text-dim">
                    {s.key} <span className="text-[10px] text-[#555]">▸ why</span>
                  </span>
                  <span className="font-bold" style={{ color: col }}>
                    {s.score}
                    <span className="ml-0.5 font-normal text-[#444]">/100</span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-[10px] bg-white/5">
                  <div
                    className="h-full"
                    style={{ width: s.score + "%", background: col, boxShadow: `0 0 10px ${col}44` }}
                  />
                </div>
              </summary>
              <div className="mx-0 mt-2 mb-1 flex flex-wrap gap-1.25">
                {(s.factors || []).map((f, i) => (
                  <span
                    key={i}
                    className="rounded-[5px] border border-white/7 bg-white/4 px-1.75 py-0.5 text-[10px] text-[#8b9bb0]"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </details>
          );
        })}
      </Card>
    </>
  );
}
