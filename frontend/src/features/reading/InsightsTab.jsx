import { useState } from "react";
import Card from "@/common/Card";
import Button from "@/common/Button";
import { asText } from "./asText";
import { useCosts } from "@/common/useCosts";
import LowCreditsCard from "@/common/LowCreditsCard";
import { Icon } from "@/utils/icons";
import { STRINGS } from "@/shared/uiStrings";
import { useChartMemory } from "@/common/useChartMemory";

// The generation pipeline, surfaced as a checklist during the wait. STEP_AT is
// the progress% at which each step turns "active"; a step reads "done" once the
// NEXT one starts. The last stays active until the result lands (this card then
// unmounts), so we never falsely claim 100%. Mirrors the MSGS stages upstream.
const GEN_STEPS = [
  "Calculating planetary positions",
  "Casting houses & ascendant",
  "Scanning aspects & patterns",
  "Writing your interpretation",
  "Finalising your reading",
];
const STEP_AT = [0, 20, 42, 64, 86];

// Insights tab: the AI-generated reading — blueprint, core cards, strengths /
// challenges, key placements, remedies, and the chat CTA. Locked by default
// (a "Unlock for N credits" preview) until the user pays; also renders the
// overloaded-retry and loading states while the reading is being generated.
export default function InsightsTab({
  interp,
  loading,
  loadMsg,
  progress = 0,
  overloaded,
  cooldown,
  lowCredits,
  onUnlock,
  onRetry,
  onOpenChat,
}) {
  const costs = useCosts();
  const cost = costs?.insights ?? 20;

  return (
    <>
      {lowCredits && !interp && (
        <div className="mb-4">
          <LowCreditsCard cost={cost} action="The detailed AI analysis" />
        </div>
      )}
      {!interp && !loading && !overloaded && !lowCredits && (
        <Card className="text-center" style={{ padding: "2.5rem 1.5rem" }}>
          <div className="mb-3 flex justify-center text-primary">
            <Icon name="SPARKLES" size={48} />
          </div>
          <p className="mx-0 mt-0 mb-1.5 text-[17px] font-bold text-ink">{STRINGS.INSIGHTS.UNLOCK_TITLE}</p>
          <p className="mx-auto mt-0 mb-5 max-w-95 text-[13px] leading-[1.6] text-subtle">
            {STRINGS.INSIGHTS.UNLOCK_SUBTITLE}
          </p>
          <Button variant="magic" onClick={onUnlock} fullWidth>
            {STRINGS.INSIGHTS.UNLOCK_BUTTON} · {cost} Credits
          </Button>
          <p className="mx-0 mt-3 mb-0 text-[11px] text-muted">{STRINGS.INSIGHTS.UNLOCK_FOOTNOTE}</p>
        </Card>
      )}
      {overloaded && !interp && (
        <Card
          className="text-center"
          style={{ borderColor: "rgba(251,191,36,0.4)", background: "rgba(251,191,36,0.08)" }}
        >
          <div className="mb-2 flex justify-center text-warning">
            <Icon name="HOURGLASS" size={36} />
          </div>
          <p className="mx-0 mt-0 mb-1.5 text-[15px] font-semibold text-warning">AI is busy right now</p>
          <p className="mx-0 mt-0 mb-4 text-[12.5px] leading-[1.6] text-subtle">
            Our reader couldn't complete your reading after several tries.
            {cooldown > 0 ? " Please wait a moment before trying again." : " You can try again now."}
          </p>
          <Button
            variant="magic"
            onClick={onRetry}
            disabled={cooldown > 0}
            fullWidth
            className="disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-1.5">
              {cooldown > 0 ? (
                <>
                  <Icon name="CLOCK" size={14} /> Try Again in {cooldown}s
                </>
              ) : (
                <>
                  <Icon name="REFRESH" size={14} /> Try Again
                </>
              )}
            </span>
          </Button>
        </Card>
      )}
      {loading && !interp && (
        <Card style={{ padding: "2.25rem 1.5rem" }}>
          <div className="flex flex-col items-center text-center">
            <div className="astrology-icon" style={{ marginBottom: 16 }}>
              <Icon name="CRYSTAL_BALL" size={40} />
            </div>
            <p className="mb-1 text-base font-medium text-ink">{loadMsg}</p>
            <p className="mb-5 text-xs text-[#666]">{STRINGS.INSIGHTS.LOADING_MSG}</p>
          </div>

          <div className="mx-auto max-w-100">
            {/* Time-estimated bar — eases toward ~92%, never claims 100% until
                the reading actually lands (LLM latency is variable). */}
            <div className="mb-1.5 flex items-center justify-between text-[11px] text-subtle">
              <span>Generating your reading</span>
              <span className="font-semibold text-primary tabular-nums">{Math.round(progress)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[rgba(168,85,247,0.12)]">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#6366f1,#a855f7)] transition-[width] duration-300 ease-out"
                style={{ width: `${Math.max(4, progress)}%` }}
              />
            </div>

            {/* The pipeline as a checklist, so the wait shows what's happening. */}
            <ul className="mt-4 list-none space-y-2.5 p-0 text-left">
              {GEN_STEPS.map((label, i) => {
                const done = progress >= (STEP_AT[i + 1] ?? 101);
                const active = !done && progress >= STEP_AT[i];
                return (
                  <li key={i} className="flex items-center gap-2.5 text-[12.5px]">
                    <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
                      {done ? (
                        <span className="font-bold text-primary">✓</span>
                      ) : active ? (
                        <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-[rgba(255,255,255,0.18)]" />
                      )}
                    </span>
                    <span className={done || active ? "text-ink" : "text-muted"}>{label}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </Card>
      )}

      {interp && (
        <div className="animate-[slideUp_0.8s_ease-out]">
          <div className="mb-6 rounded-[20px] border border-[rgba(168,85,247,0.3)] bg-[linear-gradient(135deg,rgba(99,102,241,0.2)_0%,rgba(168,85,247,0.2)_100%)] p-[clamp(1.25rem,5vw,2rem)] text-center shadow-[0_0_30px_rgba(168,85,247,0.15)]">
            <p className="mx-0 mt-0 mb-3 text-xs font-bold tracking-[3px] text-[#a855f7] uppercase">
              {STRINGS.INSIGHTS.LIFE_THEME_TITLE}
            </p>
            <p className="m-0 text-[clamp(15px,4.2vw,20px)] font-semibold leading-[1.6] text-ink italic">
              "{asText(interp.lifeTheme)}"
            </p>
          </div>

          {interp.pastCheck?.question && (
            <div className="mb-4">
              <TimelineCheck pastCheck={interp.pastCheck} />
            </div>
          )}

          <div className="grid gap-4">
            {[
              ["Core Identity", "SPARKLES", asText(interp.bigThree), null],
              ["Personality Matrix", "USER", asText(interp.personality), "personality"],
              ["Destiny & Purpose", "BRIEFCASE", asText(interp.career), "career"],
              ["Heart & Soul", "HEART_YELLOW", asText(interp.relationships), "relationships"],
            ].map(
              ([title, icon, content, evKey], idx) =>
                content && (
                  // margin:0 (override cosmic-card) + computed animationDelay → inline.
                  <Card key={title} style={{ margin: 0, animationDelay: `${idx * 0.1}s` }}>
                    <div className="mb-3 flex items-center gap-2.5">
                      <span className="astrology-icon" style={{ margin: 0 }}>
                        <Icon name={icon} size={22} />
                      </span>
                      <p className="m-0 text-[15px] font-bold tracking-[0.5px] text-ink">{title}</p>
                    </div>
                    <p className="m-0 text-[13px] leading-[1.7] text-dim">{content}</p>
                    {/* "Show your work" — the exact chart factors behind this section. */}
                    {evKey && interp.evidence?.[evKey] && (
                      <p className="m-0 mt-3 rounded-lg border border-[rgba(168,85,247,0.25)] bg-[rgba(168,85,247,0.08)] px-3 py-2 text-[11.5px] leading-[1.6] text-[#c4b5fd]">
                        <Icon name="SPARKLES" size={12} className="inline align-middle" />{" "}
                        <span className="font-semibold">Astrology logic:</span> {interp.evidence[evKey]}
                      </p>
                    )}
                  </Card>
                )
            )}
          </div>

          <div className="grid-2 my-5">
            {/* cosmic-card margin/border/bg overridden inline (unlayered). */}
            <Card
              style={{
                margin: 0,
                borderColor: "rgba(34, 197, 94, 0.2)",
                background: "rgba(20, 30, 20, 0.4)",
              }}
            >
              <p className="mb-4 flex items-center gap-2 text-[15px] font-bold text-success">
                <Icon name="STAR" size={18} /> Celestial Strengths
              </p>
              {(interp.strengths || []).map((s, i) => (
                <div key={i} className="mb-2.5 flex gap-2.5 text-sm leading-normal text-dim">
                  <Icon name="SHIELD" size={15} className="mt-0.5 shrink-0 text-success" />
                  <span>{asText(s)}</span>
                </div>
              ))}
            </Card>
            <Card
              style={{
                margin: 0,
                borderColor: "rgba(251, 191, 36, 0.2)",
                background: "rgba(30, 25, 20, 0.4)",
              }}
            >
              <p className="mb-4 flex items-center gap-2 text-[15px] font-bold text-warning">
                <Icon name="STAR" size={18} /> Growth Thresholds
              </p>
              {(interp.challenges || []).map((c, i) => (
                <div key={i} className="mb-2.5 flex gap-2.5 text-sm leading-normal text-dim">
                  <Icon name="ARROW_UP" size={15} className="mt-0.5 shrink-0 text-warning" />
                  <span>{asText(c)}</span>
                </div>
              ))}
            </Card>
          </div>

          {interp.keyPlacements && (
            <Card>
              <p className="m-0 mb-4 flex items-center gap-2 text-base font-bold text-ink">
                <Icon name="KEY" size={16} /> Key Celestial Placements
              </p>
              <div className="grid gap-3">
                {interp.keyPlacements.map((k, i) => (
                  <p
                    key={i}
                    className="m-0 rounded-xl border-l-4 border-accent bg-white/3 px-4 py-3 text-[14.5px] leading-[1.7] text-dim"
                  >
                    {asText(k)}
                  </p>
                ))}
              </div>
            </Card>
          )}

          {interp.remedies && (
            <Card style={{ borderColor: "rgba(168, 85, 247, 0.2)", background: "rgba(30, 20, 30, 0.4)" }}>
              <p className="m-0 mb-4 flex items-center gap-2 text-base font-bold text-[#c084fc]">
                <Icon name="DIYA" size={16} /> Karmic Harmonization & Remedies
              </p>
              <div className="grid gap-2.5">
                {interp.remedies.map((r, i) => (
                  <p key={i} className="m-0 flex gap-2.5 text-[14.5px] leading-[1.7] text-[#c084fc]">
                    <Icon name="SPARKLES" size={15} className="mt-0.5 shrink-0 opacity-80" />{" "}
                    <span>{asText(r)}</span>
                  </p>
                ))}
              </div>
            </Card>
          )}

          {/* Follow-up chat lives on its own route */}
          <Card className="text-center" style={{ marginTop: 24 }}>
            <p className="m-0 mb-1 inline-flex items-center gap-2 text-base font-bold text-[#c084fc]">
              <Icon name="CHAT" size={16} /> Ask About Your Birth Chart
            </p>
            <p className="m-0 mb-4 text-xs text-muted">
              Ask anything about your future, career, marriage or timing — answered from your chart only.
            </p>
            <Button variant="magic" onClick={onOpenChat} fullWidth>
              <span className="inline-flex items-center gap-1.5">
                Open Chat <Icon name="ARROW_UP_RIGHT" size={15} />
              </span>
            </Button>
          </Card>

          <p className="mx-auto mt-10 max-w-125 text-center text-[11px] leading-[1.8] tracking-[0.5px] text-[#444]">
            Disclaimer: Astrology is a tool for self-reflection and spiritual insight. Celestial cycles
            reflect possibilities, not certainties. Always use your own judgment.
          </p>
        </div>
      )}
    </>
  );
}

// "Timeline Check" — a single grounded yes/no question that tests the chart
// against the user's real past (pastCheck.basis is a genuine dasha/transit
// window, computed — not a cold read). HONEST by design: the acknowledgement
// reflects the user's ACTUAL answer instead of "confirmed" no matter what.
function TimelineCheck({ pastCheck }) {
  // Persist the answer (keyed by the question) so it's remembered across reloads
  // — once the user responds we never re-ask. Read synchronously on first render.
  const key = pastCheck?.question ? `timelineCheck:${pastCheck.question}` : null;
  const [stored, setStored] = useChartMemory(key);
  const answer = stored === "yes" || stored === "no" ? stored : null;
  if (!pastCheck?.question) return null;

  const choose = (v) => setStored(v);

  if (answer) {
    const msg =
      answer === "yes"
        ? `That tracks with your chart — this window is shaped by ${pastCheck.basis || "the active dasha"}. Your reading weighs it accordingly.`
        : "Good to know — the same transit doesn't land the same way for everyone. Your reading focuses on the patterns active for you now.";
    return (
      <Card style={{ borderColor: "rgba(168,85,247,0.3)", background: "rgba(30,20,45,0.45)" }}>
        <p className="m-0 flex gap-1.5 text-[13px] leading-[1.7] text-[#c4b5fd]">
          <Icon name={answer === "yes" ? "SPARKLES" : "TARGET"} size={14} className="mt-0.5 shrink-0" />{" "}
          <span>{msg}</span>
        </p>
      </Card>
    );
  }

  return (
    <Card style={{ borderColor: "rgba(168,85,247,0.4)", background: "rgba(30,20,45,0.55)" }}>
      <p className="mx-0 mt-0 mb-1 inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[2px] text-[#a855f7] uppercase">
        <Icon name="SPARKLES" size={12} /> Timeline Check
      </p>
      <p className="mx-0 mt-0 mb-4 text-[14px] leading-[1.6] font-semibold text-ink">{pastCheck.question}</p>
      <div className="flex gap-3">
        <button
          onClick={() => choose("yes")}
          className="flex-1 cursor-pointer rounded-[10px] border border-[rgba(34,197,94,0.4)] bg-[rgba(34,197,94,0.12)] p-2.5 text-[13px] font-semibold text-[#4ade80]"
        >
          Yes, that's true
        </button>
        <button
          onClick={() => choose("no")}
          className="flex-1 cursor-pointer rounded-[10px] border border-[rgba(255,255,255,0.15)] bg-white/5 p-2.5 text-[13px] font-semibold text-subtle"
        >
          No, not really
        </button>
      </div>
    </Card>
  );
}
