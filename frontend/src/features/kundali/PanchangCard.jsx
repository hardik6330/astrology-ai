// Five vedic time-elements at the moment of birth.

import Card from "@/common/Card";
import { STRINGS } from "@/shared/uiStrings";
import { tithiEnglish } from "@/shared/panchangText";

export default function PanchangCard({ panchang }) {
  if (!panchang) return null;
  const items = [
    [STRINGS.PANCHANG.TITHI, tithiEnglish(panchang.tithi)],
    [STRINGS.PANCHANG.NAKSHATRA, `${panchang.nakshatra} · Quarter ${panchang.pada}`],
    [STRINGS.PANCHANG.YOGA, panchang.yoga],
    [STRINGS.PANCHANG.KARANA, panchang.karana],
    [STRINGS.PANCHANG.VAARA, panchang.vaara],
  ];

  return (
    <Card>
      <p className="m-0 mb-1 text-sm font-semibold text-ink">{STRINGS.PANCHANG.TITLE}</p>
      <p className="m-0 mb-3 text-[11px] text-muted">{STRINGS.PANCHANG.SUBTITLE}</p>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2">
        {items.map(([k, v]) => (
          <div key={k} className="rounded-[10px] border border-white/8 bg-white/4 px-3 py-2.5">
            <p className="m-0 text-[10px] tracking-[1px] text-muted uppercase">{k}</p>
            <p className="mt-0.75 mb-0 text-[13px] font-bold text-ink">{v}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
