import { useState } from "react";
import Card from "@/common/Card";
import Button from "@/common/Button";
import { asText } from "./asText";
import { useCosts } from "@/common/useCosts";
import LowCreditsCard from "@/common/LowCreditsCard";
import { EMOJIS } from "@/utils/emojis";

// Insights tab: the AI-generated reading — blueprint, core cards, strengths /
// challenges, key placements, remedies, and the chat CTA. Locked by default
// (a "Unlock for N credits" preview) until the user pays; also renders the
// overloaded-retry and loading states while the reading is being generated.
export default function InsightsTab({
  interp,
  loading,
  loadMsg,
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
          <div className="mb-3 text-5xl">{EMOJIS.SPARKLES || "✨"}</div>
          <p className="mx-0 mt-0 mb-1.5 text-[17px] font-bold text-ink">Unlock Your Cosmic Blueprint</p>
          <p className="mx-auto mt-0 mb-5 max-w-95 text-[13px] leading-[1.6] text-subtle">
            A deep, personalised AI reading of your chart — core identity, career, relationships, strengths,
            remedies and more.
          </p>
          <Button variant="magic" onClick={onUnlock} fullWidth>
            Unlock Detailed AI Analysis · {cost} Credits
          </Button>
          <p className="mx-0 mt-3 mb-0 text-[11px] text-muted">
            One-time charge per chart. Re-viewing is always free.
          </p>
        </Card>
      )}
      {overloaded && !interp && (
        <Card
          className="text-center"
          style={{ borderColor: "rgba(251,191,36,0.4)", background: "rgba(251,191,36,0.08)" }}
        >
          <div className="mb-2 text-4xl">{EMOJIS.HOURGLASS}</div>
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
            {cooldown > 0 ? `${EMOJIS.CLOCK} Try Again in ${cooldown}s` : `${EMOJIS.REFRESH} Try Again`}
          </Button>
        </Card>
      )}
      {loading && !interp && (
        <Card className="text-center" style={{ padding: "3rem 1.5rem" }}>
          <div className="astrology-icon" style={{ fontSize: 40, marginBottom: 20 }}>
            {EMOJIS.CRYSTAL_BALL}
          </div>
          <p className="mb-2 text-base font-medium text-ink">{loadMsg}</p>
          <p className="text-xs text-[#666]">The stars are aligning for you...</p>
        </Card>
      )}

      {interp && (
        <div className="animate-[slideUp_0.8s_ease-out]">
          <div className="mb-6 rounded-[20px] border border-[rgba(168,85,247,0.3)] bg-[linear-gradient(135deg,rgba(99,102,241,0.2)_0%,rgba(168,85,247,0.2)_100%)] p-[clamp(1.25rem,5vw,2rem)] text-center shadow-[0_0_30px_rgba(168,85,247,0.15)]">
            <p className="mx-0 mt-0 mb-3 text-xs font-bold tracking-[3px] text-[#a855f7] uppercase">
              Cosmic Blueprint
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
              ["Core Identity", EMOJIS.SPARKLES, asText(interp.bigThree), null],
              ["Personality Matrix", EMOJIS.USER, asText(interp.personality), "personality"],
              ["Destiny & Purpose", EMOJIS.BRIEFCASE, asText(interp.career), "career"],
              ["Heart & Soul", EMOJIS.HEART_YELLOW, asText(interp.relationships), "relationships"],
            ].map(
              ([title, icon, content, evKey], idx) =>
                content && (
                  // margin:0 (override cosmic-card) + computed animationDelay → inline.
                  <Card key={title} style={{ margin: 0, animationDelay: `${idx * 0.1}s` }}>
                    <div className="mb-3 flex items-center gap-2.5">
                      <span className="astrology-icon" style={{ margin: 0, fontSize: 22 }}>
                        {icon}
                      </span>
                      <p className="m-0 text-[15px] font-bold tracking-[0.5px] text-ink">{title}</p>
                    </div>
                    <p className="m-0 text-[13px] leading-[1.7] text-dim">{content}</p>
                    {/* "Show your work" — the exact chart factors behind this section. */}
                    {evKey && interp.evidence?.[evKey] && (
                      <p className="m-0 mt-3 rounded-lg border border-[rgba(168,85,247,0.25)] bg-[rgba(168,85,247,0.08)] px-3 py-2 text-[11.5px] leading-[1.6] text-[#c4b5fd]">
                        {EMOJIS.SPARKLES} <span className="font-semibold">Astrology logic:</span>{" "}
                        {interp.evidence[evKey]}
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
                <span className="text-xl">✦</span> Celestial Strengths
              </p>
              {(interp.strengths || []).map((s, i) => (
                <div key={i} className="mb-2.5 flex gap-2.5 text-sm leading-normal text-dim">
                  <span className="font-bold text-success">✓</span>
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
                <span className="text-xl">✦</span> Growth Thresholds
              </p>
              {(interp.challenges || []).map((c, i) => (
                <div key={i} className="mb-2.5 flex gap-2.5 text-sm leading-normal text-dim">
                  <span className="font-bold text-warning">↑</span>
                  <span>{asText(c)}</span>
                </div>
              ))}
            </Card>
          </div>

          {interp.keyPlacements && (
            <Card>
              <p className="m-0 mb-4 text-base font-bold text-ink">{EMOJIS.KEY} Key Celestial Placements</p>
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
              <p className="m-0 mb-4 text-base font-bold text-[#c084fc]">
                {EMOJIS.DIYA} Cosmic Guidance & Remedies
              </p>
              <div className="grid gap-2.5">
                {interp.remedies.map((r, i) => (
                  <p key={i} className="m-0 flex gap-2.5 text-[14.5px] leading-[1.7] text-[#c084fc]">
                    <span className="opacity-80">{EMOJIS.SPARKLES}</span> <span>{asText(r)}</span>
                  </p>
                ))}
              </div>
            </Card>
          )}

          {/* Follow-up chat lives on its own route */}
          <Card className="text-center" style={{ marginTop: 24 }}>
            <p className="m-0 mb-1 text-base font-bold text-[#c084fc]">{EMOJIS.CHAT} Ask About Your Kundli</p>
            <p className="m-0 mb-4 text-xs text-muted">
              Ask anything about your future, career, marriage or timing — answered from your chart only.
            </p>
            <Button variant="magic" onClick={onOpenChat} fullWidth>
              Open Chat {EMOJIS.ARROW_UP_RIGHT}
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
  const [answer, setAnswer] = useState(() => {
    if (!key || typeof localStorage === "undefined") return null;
    const v = localStorage.getItem(key);
    return v === "yes" || v === "no" ? v : null;
  });
  if (!pastCheck?.question) return null;

  function choose(v) {
    setAnswer(v);
    try {
      localStorage.setItem(key, v);
    } catch {
      /* best-effort */
    }
  }

  if (answer) {
    const msg =
      answer === "yes"
        ? `That tracks with your chart — this window is shaped by ${pastCheck.basis || "the active dasha"}. Your reading weighs it accordingly.`
        : "Good to know — the same transit doesn't land the same way for everyone. Your reading focuses on the patterns active for you now.";
    return (
      <Card style={{ borderColor: "rgba(168,85,247,0.3)", background: "rgba(30,20,45,0.45)" }}>
        <p className="m-0 text-[13px] leading-[1.7] text-[#c4b5fd]">
          {answer === "yes" ? EMOJIS.SPARKLES : "🧭"} {msg}
        </p>
      </Card>
    );
  }

  return (
    <Card style={{ borderColor: "rgba(168,85,247,0.4)", background: "rgba(30,20,45,0.55)" }}>
      <p className="mx-0 mt-0 mb-1 text-[11px] font-bold tracking-[2px] text-[#a855f7] uppercase">
        {EMOJIS.SPARKLES} Timeline Check
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
