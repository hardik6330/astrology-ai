// Live readings for Mangal, Kaal Sarp, Pitra and Sade Sati — drawn from
// the chart's computed `doshas` object (no AI, deterministic).

import Card from "@/common/Card";

function tone(state) {
  switch (state) {
    case "good":
      return { bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.45)", fg: "#4ade80" };
    case "warn":
      return { bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.45)", fg: "#fbbf24" };
    case "bad":
      return { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.45)", fg: "#f87171" };
    default:
      return { bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.1)", fg: "#94a3b8" };
  }
}

function Row({ title, badge, state, detail }) {
  const t = tone(state);
  return (
    <div className="border-b border-white/6 py-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-subtle">{title}</span>
        {/* Tone colors are data-driven → inline; shape/typography → utilities. */}
        <span
          className="rounded-full border px-2.5 py-0.75 text-[10px] font-bold tracking-[0.5px] uppercase"
          style={{ background: t.bg, borderColor: t.border, color: t.fg }}
        >
          {badge}
        </span>
      </div>
      {detail && <p className="mt-1 mb-0 text-[11.5px] leading-normal text-dim">{detail}</p>}
    </div>
  );
}

export default function DoshaCard({ doshas }) {
  if (!doshas) return null;
  const mangalState =
    doshas.mangal.level === "None" || doshas.mangal.level === "Cancelled"
      ? "good"
      : doshas.mangal.level === "Mild"
        ? "warn"
        : "bad";
  const kaalSarpState = doshas.kaalSarp.present ? "bad" : "good";
  const pitraState = doshas.pitra.present ? "warn" : "good";
  const sadeState = doshas.sadeSati.active ? "warn" : "good";

  return (
    <Card>
      <p className="m-0 mb-1 text-sm font-semibold text-ink">Afflictions & Combinations</p>
      <p className="m-0 mb-3 text-[11px] text-muted">Live readings of major astrological conditions.</p>
      <Row
        title="Mars Affliction"
        badge={doshas.mangal.level}
        state={mangalState}
        detail={doshas.mangal.detail}
      />
      <Row
        title="Nodal Affliction"
        badge={doshas.kaalSarp.present ? "Active" : "Free"}
        state={kaalSarpState}
        detail={doshas.kaalSarp.detail}
      />
      <Row
        title="Ancestral Affliction"
        badge={doshas.pitra.present ? "Active" : "Free"}
        state={pitraState}
        detail={doshas.pitra.detail}
      />
      <Row
        title="Saturn Cycle"
        badge={doshas.sadeSati.active ? doshas.sadeSati.phase.split(" ")[0] : "Free"}
        state={sadeState}
        detail={doshas.sadeSati.detail}
      />
    </Card>
  );
}
