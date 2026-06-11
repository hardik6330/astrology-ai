// Single-hand reading result: photo header, vibe blueprint, per-line cards,
// strengths/watch-outs, practical guidance, classical notes — or the
// categorized retake card when the image came back unusable.

import Card from "@/common/Card";
import Button from "@/common/Button";
import { REJECT_INFO, BLUEPRINT, BLUEPRINT_QUOTE, LINE_TITLE, BULLET_ROW, DISCLAIMER } from "../constants";

export default function ReadingResult({ palm, preview, onReset }) {
  const unusable = palm.imageQuality === "unusable";

  if (unusable) {
    const info = REJECT_INFO[palm.rejectReason] || REJECT_INFO.default;
    return (
      <Card
        className="text-center"
        style={{
          padding: "2rem 1.5rem",
          borderColor: "rgba(248,113,113,0.4)",
          background: "rgba(248,113,113,0.06)",
        }}
      >
        {preview && (
          <div className="mx-auto mb-4 h-35 w-35 overflow-hidden rounded-xl border border-[rgba(248,113,113,0.45)] shadow-[0_0_18px_rgba(248,113,113,0.2)]">
            <img src={preview} alt="uploaded palm" className="block h-full w-full object-cover" />
          </div>
        )}
        <div className="mb-3 text-[44px]">{info.icon}</div>
        <p className="mx-0 mt-0 mb-2 text-base font-bold text-danger">{info.title}</p>
        <p className="mx-0 mt-0 mb-1.5 text-[13.5px] leading-[1.65] text-subtle">{info.tip}</p>
        {palm.retakeReason && (
          <p className="mx-0 mt-0 mb-4.5 text-xs leading-[1.6] text-muted italic">{palm.retakeReason}</p>
        )}
        <Button variant="magic" onClick={onReset} fullWidth>
          📷 Upload Another Photo
        </Button>
      </Card>
    );
  }

  return (
    <div className="animate-[slideUp_0.8s_ease-out]">
      {/* Clean photo header — no overlay (Gemini's spatial accuracy isn't reliable). */}
      {preview && (
        <Card className="text-center" style={{ padding: 14 }}>
          {palm.handType && palm.handType !== "Unclear" && (
            <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-[rgba(168,85,247,0.5)] bg-[rgba(168,85,247,0.12)] px-3.5 py-1.5 text-xs font-bold tracking-[1.5px] text-[#c4b5fd] uppercase">
              <span className="text-sm">{palm.handType === "Right" ? "✋" : "🤚"}</span>
              {palm.handType} Hand
            </div>
          )}
          <div className="mx-auto w-full max-w-80 overflow-hidden rounded-[14px] border border-[rgba(168,85,247,0.3)]">
            <img src={preview} alt="palm" className="block w-full" />
          </div>
        </Card>
      )}

      <div className={BLUEPRINT}>
        <p className="mx-0 mt-0 mb-1.5 text-xs font-bold tracking-[3px] text-[#a855f7] uppercase">
          {palm.handType} Hand · {palm.imageQuality}
        </p>
        <p className={BLUEPRINT_QUOTE}>"{palm.overallVibe}"</p>
      </div>

      <div className="grid gap-4">
        {[
          ["Life Line", "🌿", palm.lifeLine],
          ["Head Line", "🧠", palm.headLine],
          ["Heart Line", "💛", palm.heartLine],
          ["Fate Line", "🪐", palm.fateLine],
          ["Mount of Venus", "✨", palm.mountOfVenus],
          ["Marriage Lines", "💍", palm.marriageLines],
        ].map(
          ([title, icon, content]) =>
            content && (
              <Card key={title} style={{ margin: 0 }}>
                <div className="mb-2.5 flex items-center gap-2.5">
                  <span className="text-[22px]">{icon}</span>
                  <p className={LINE_TITLE}>{title}</p>
                </div>
                <p className="m-0 text-[13px] leading-[1.7] text-dim">{content}</p>
              </Card>
            )
        )}
      </div>

      <div className="grid-2 my-5">
        {palm.strengths?.length > 0 && (
          <Card
            style={{
              margin: 0,
              borderColor: "rgba(34, 197, 94, 0.2)",
              background: "rgba(20, 30, 20, 0.4)",
            }}
          >
            <p className="mb-3.5 text-[15px] font-bold text-[#4ade80]">✦ Strengths</p>
            {palm.strengths.map((s, i) => (
              <div key={i} className={BULLET_ROW}>
                <span className="font-bold text-[#4ade80]">✓</span>
                <span>{s}</span>
              </div>
            ))}
          </Card>
        )}
        {palm.watchOuts?.length > 0 && (
          <Card
            style={{
              margin: 0,
              borderColor: "rgba(251, 191, 36, 0.2)",
              background: "rgba(30, 25, 20, 0.4)",
            }}
          >
            <p className="mb-3.5 text-[15px] font-bold text-warning">✦ Watch For</p>
            {palm.watchOuts.map((c, i) => (
              <div key={i} className={BULLET_ROW}>
                <span className="font-bold text-warning">↑</span>
                <span>{c}</span>
              </div>
            ))}
          </Card>
        )}
      </div>

      {palm.practicalGuidance && (palm.practicalGuidance.career || palm.practicalGuidance.love) && (
        <Card style={{ borderColor: "rgba(168,85,247,0.25)", background: "rgba(30,20,45,0.5)" }}>
          <p className="mx-0 mt-0 mb-1 text-[15px] font-bold text-[#c084fc]">🎯 Practical Guidance</p>
          <p className="mx-0 mt-0 mb-3.5 text-[11px] text-muted">
            Concrete next steps from your Fate and Heart lines
          </p>
          <div className="grid gap-3">
            {palm.practicalGuidance.career && (
              <div className="rounded-[10px] border-l-[3px] border-[#fbbf24] bg-[rgba(251,191,36,0.08)] px-3.5 py-3">
                <p className="mx-0 mt-0 mb-1 text-[10px] font-bold tracking-[1.5px] text-warning">CAREER</p>
                <p className="m-0 text-[13px] leading-[1.65] text-body">{palm.practicalGuidance.career}</p>
              </div>
            )}
            {palm.practicalGuidance.love && (
              <div className="rounded-[10px] border-l-[3px] border-[#f87171] bg-[rgba(248,113,113,0.08)] px-3.5 py-3">
                <p className="mx-0 mt-0 mb-1 text-[10px] font-bold tracking-[1.5px] text-danger">LOVE</p>
                <p className="m-0 text-[13px] leading-[1.65] text-body">{palm.practicalGuidance.love}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {palm.palmistryNotes?.length > 0 && (
        <Card style={{ borderColor: "rgba(99,102,241,0.25)", background: "rgba(20,22,40,0.5)" }}>
          <p className="mx-0 mt-0 mb-1 text-[15px] font-bold text-[#a5b4fc]">📜 Classical Palmistry Notes</p>
          <p className="mx-0 mt-0 mb-3.5 text-[11px] text-muted">
            Traditional rules cross-checked against your reading
          </p>
          <div className="grid gap-2">
            {palm.palmistryNotes.map((n, i) => (
              <div
                key={i}
                className="flex gap-2.5 rounded-lg border-l-[3px] border-accent bg-white/3 px-3 py-2 text-[13px] leading-[1.55] text-subtle"
              >
                <span className="font-bold text-[#a5b4fc]">✓</span>
                <span>{n}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <button
        onClick={onReset}
        className="w-full cursor-pointer rounded-[10px] border border-[rgba(168,85,247,0.4)] bg-[rgba(168,85,247,0.12)] p-3 text-[13px] font-semibold text-[#c084fc]"
      >
        🔄 Scan a Different Palm
      </button>

      <p className={DISCLAIMER}>
        Palmistry is a tool for self-reflection. Insights here are interpretive, not predictive.
      </p>
    </div>
  );
}
