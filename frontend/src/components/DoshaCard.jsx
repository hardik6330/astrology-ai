// Live readings for Mangal, Kaal Sarp, Pitra and Sade Sati — drawn from
// the chart's computed `doshas` object (no AI, deterministic).

function tone(state) {
  switch (state) {
    case "good": return { bg: "rgba(34,197,94,0.12)",  border: "rgba(34,197,94,0.45)",  fg: "#4ade80" };
    case "warn": return { bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.45)", fg: "#fbbf24" };
    case "bad":  return { bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.45)",  fg: "#f87171" };
    default:     return { bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.1)", fg: "#94a3b8" };
  }
}

function Row({ title, badge, state, detail }) {
  const t = tone(state);
  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#cbd5e1", fontSize: 13, fontWeight: 600 }}>{title}</span>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
          padding: "3px 10px", borderRadius: 9999,
          background: t.bg, border: `1px solid ${t.border}`, color: t.fg,
        }}>{badge}</span>
      </div>
      {detail && (
        <p style={{ color: "#94a3b8", fontSize: 11.5, lineHeight: 1.5, margin: "4px 0 0" }}>{detail}</p>
      )}
    </div>
  );
}

export default function DoshaCard({ doshas }) {
  if (!doshas) return null;
  const mangalState =
    doshas.mangal.level === "None" || doshas.mangal.level === "Cancelled" ? "good"
    : doshas.mangal.level === "Mild" ? "warn"
    : "bad";
  const kaalSarpState = doshas.kaalSarp.present ? "bad"  : "good";
  const pitraState    = doshas.pitra.present    ? "warn" : "good";
  const sadeState     = doshas.sadeSati.active  ? "warn" : "good";

  return (
    <div className="cosmic-card">
      <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px", color: "#fff" }}>Dosha & Yoga Status</p>
      <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 12px" }}>
        Live readings of major astrological conditions.
      </p>
      <Row title="Mangal Dosha"    badge={doshas.mangal.level}                                state={mangalState}   detail={doshas.mangal.detail} />
      <Row title="Kaal Sarp Dosha" badge={doshas.kaalSarp.present ? "Active" : "Free"}        state={kaalSarpState} detail={doshas.kaalSarp.detail} />
      <Row title="Pitra Dosha"     badge={doshas.pitra.present    ? "Active" : "Free"}        state={pitraState}    detail={doshas.pitra.detail} />
      <Row title="Sade Sati"       badge={doshas.sadeSati.active  ? doshas.sadeSati.phase.split(" ")[0] : "Free"} state={sadeState} detail={doshas.sadeSati.detail} />
    </div>
  );
}
