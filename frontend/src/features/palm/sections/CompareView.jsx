// Both-Hands comparison view — replaces the single-hand UI entirely. Four
// states: still analyzing (scan animation), Pro overloaded (cooldown card),
// either hand unusable (per-hand retake card), or ready.

import Card from "@/common/Card";
import Button from "@/common/Button";
import BottomNav from "@/components/BottomNav";
import { REJECT_INFO, BLUEPRINT, BLUEPRINT_QUOTE, LINE_TITLE, BULLET_ROW, DISCLAIMER } from "../constants";

export default function CompareView({
  form,
  comparison,
  leftPhoto,
  rightPhoto,
  analyzing,
  overloaded,
  cooldown,
  scanMsg,
  lowCreditsCard,
  onRetry,
  onResetCompare,
  onScanDifferentHand,
}) {
  const c = comparison?.comparison;
  const leftBad = comparison?.left?.imageQuality === "unusable";
  const rightBad = comparison?.right?.imageQuality === "unusable";
  const eitherBad = leftBad || rightBad;

  // Card border override stays inline — .cosmic-card is unlayered and would
  // otherwise beat a Tailwind border utility.
  const cardStyle = { borderColor: "rgba(168,85,247,0.35)" };
  return (
    <div className="relative mx-auto max-w-180 px-4 pt-8 pb-30">
      <div className="cosmos"></div>
      <div className="stars"></div>

      <div className="mb-6 text-center">
        <p className="text-[13px] font-semibold tracking-[1px] text-[#a855f7] uppercase">
          {form.name || "Your"} · Full Life Comparison
        </p>
        <p className="mt-1.5 text-[11px] text-muted">
          🔒 Your photos are analyzed and discarded — never stored.
        </p>
      </div>

      {lowCreditsCard}

      {/* Both photos, side by side */}
      {(leftPhoto || rightPhoto) && (
        <Card style={cardStyle}>
          <div className="grid grid-cols-2 gap-3">
            {[
              ["Potential", leftPhoto, "Left"],
              ["Reality", rightPhoto, "Right"],
            ].map(([label, src, hand]) => (
              <div
                key={hand}
                className="overflow-hidden rounded-xl border border-[rgba(168,85,247,0.3)] bg-[rgba(15,14,32,0.6)]"
              >
                <div className="aspect-3/4 bg-[#0f0e20]">
                  {src ? (
                    <img src={src} alt={`${hand} palm`} className="block h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="px-2.5 py-2 text-center">
                  <p className="m-0 text-[11px] font-bold tracking-[1.5px] text-[#c4b5fd] uppercase">
                    {hand}
                  </p>
                  <p className="mx-0 mt-0.5 mb-0 text-xs text-dim">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Scan / overloaded / unusable / ready */}
      {analyzing && !comparison && (
        <Card className="text-center" style={cardStyle}>
          {leftPhoto && rightPhoto ? (
            <div className="mb-4 flex justify-center gap-5">
              {[leftPhoto, rightPhoto].map((src, idx) => (
                <div
                  key={idx}
                  className="relative h-33 w-25 overflow-hidden rounded-xl border border-[rgba(168,85,247,0.4)] shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                >
                  <img src={src} alt="scanning palm" className="h-full w-full object-cover" />
                  <div
                    className="absolute top-0 right-0 left-0 h-0.5 bg-[#c084fc] shadow-[0_0_8px_#c084fc]"
                    style={{ animation: "palmScan 1.8s ease-in-out infinite" }}
                  />
                </div>
              ))}
            </div>
          ) : null}
          <p className="m-0 text-sm font-semibold text-[#c084fc]">{scanMsg}</p>
          <p className="mt-1.5 text-[11px] text-muted">Comparing the two hands — usually 20–45 seconds.</p>
        </Card>
      )}

      {overloaded && !analyzing && !comparison && (
        <Card
          className="text-center"
          style={{ borderColor: "rgba(251,191,36,0.4)", background: "rgba(251,191,36,0.08)" }}
        >
          <div className="mb-2 text-4xl">⏳</div>
          <p className="mx-0 mt-0 mb-1.5 text-[15px] font-semibold text-warning">AI is busy right now</p>
          <p className="mx-0 mt-0 mb-4 text-[12.5px] leading-[1.6] text-subtle">
            Our reader couldn't compare your palms after several tries.
            {cooldown > 0 ? " Please wait a moment before trying again." : " You can try again now."}
          </p>
          <Button
            variant="magic"
            onClick={onRetry}
            disabled={cooldown > 0}
            fullWidth
            className="disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cooldown > 0 ? `🕒 Try Again in ${cooldown}s` : "🔄 Try Again"}
          </Button>
        </Card>
      )}

      {comparison &&
        eitherBad &&
        (() => {
          // Pull the specific reject reason + tip for each failed hand so
          // the user knows *exactly* what to fix (wrong_hand vs blurry vs
          // too_dark etc.) instead of a generic lighting prompt.
          const badHands = [
            leftBad
              ? {
                  side: "Left",
                  info: REJECT_INFO[comparison.left.rejectReason] || REJECT_INFO.default,
                  server: comparison.left.retakeReason,
                }
              : null,
            rightBad
              ? {
                  side: "Right",
                  info: REJECT_INFO[comparison.right.rejectReason] || REJECT_INFO.default,
                  server: comparison.right.retakeReason,
                }
              : null,
          ].filter(Boolean);

          return (
            <Card style={{ borderColor: "rgba(248,113,113,0.4)", background: "rgba(248,113,113,0.06)" }}>
              <p className="mx-0 mt-0 mb-3.5 text-center text-[15px] font-bold text-danger">
                {badHands.length === 2
                  ? "Both photos need a retake"
                  : `${badHands[0].side} photo needs a retake`}
              </p>

              <div className="grid gap-3">
                {badHands.map(({ side, info, server }) => (
                  <div
                    key={side}
                    className="flex items-start gap-3 rounded-[10px] border border-[rgba(248,113,113,0.35)] bg-[rgba(15,14,32,0.55)] px-3.5 py-3"
                  >
                    <div className="shrink-0 text-[28px] leading-none">{info.icon}</div>
                    <div className="min-w-0 flex-1">
                      <p className="m-0 text-xs font-bold tracking-[1.5px] text-warning uppercase">
                        {side} Hand
                      </p>
                      <p className="my-1 text-sm font-bold text-danger">{info.title}</p>
                      <p className="m-0 text-[12.5px] leading-[1.55] text-subtle">{server || info.tip}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Button variant="magic" onClick={onResetCompare} fullWidth className="mt-3.5">
                📷 Retake Both Photos
              </Button>
            </Card>
          );
        })()}

      {c && !eitherBad && (
        <div className="animate-[slideUp_0.8s_ease-out]">
          {/* Evolution headline */}
          <div className={BLUEPRINT}>
            <p className="mx-0 mt-0 mb-1.5 text-xs font-bold tracking-[3px] text-[#a855f7] uppercase">
              Alignment · {c.alignment || "—"}
            </p>
            <p className={BLUEPRINT_QUOTE}>"{c.evolution}"</p>
          </div>

          {/* Per-line gap analysis */}
          <div className="grid gap-4">
            {[
              ["Life Line", "🌿", c.lifeLine],
              ["Head Line", "🧠", c.headLine],
              ["Heart Line", "💛", c.heartLine],
              ["Fate Line", "🪐", c.fateLine],
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

          {/* Grown / Watch */}
          <div className="grid-2 my-5">
            {c.grownStronger?.length > 0 && (
              <Card
                style={{ margin: 0, borderColor: "rgba(34,197,94,0.2)", background: "rgba(20,30,20,0.4)" }}
              >
                <p className="mb-3.5 text-[15px] font-bold text-[#4ade80]">✦ Grown Stronger</p>
                {c.grownStronger.map((s, i) => (
                  <div key={i} className={BULLET_ROW}>
                    <span className="font-bold text-[#4ade80]">↑</span>
                    <span>{s}</span>
                  </div>
                ))}
              </Card>
            )}
            {c.watchPoints?.length > 0 && (
              <Card
                style={{ margin: 0, borderColor: "rgba(251,191,36,0.2)", background: "rgba(30,25,20,0.4)" }}
              >
                <p className="mb-3.5 text-[15px] font-bold text-warning">✦ Still Showing Up</p>
                {c.watchPoints.map((w, i) => (
                  <div key={i} className={BULLET_ROW}>
                    <span className="font-bold text-warning">•</span>
                    <span>{w}</span>
                  </div>
                ))}
              </Card>
            )}
          </div>

          {c.lifeAdvice && (
            <Card style={{ borderColor: "rgba(168,85,247,0.25)", background: "rgba(30,20,45,0.5)" }}>
              <p className="mx-0 mt-0 mb-2.5 text-[15px] font-bold text-[#c084fc]">🎯 Direction</p>
              <p className="m-0 text-[13.5px] leading-[1.7] text-body">{c.lifeAdvice}</p>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onResetCompare}
              className="w-full cursor-pointer rounded-[10px] border border-[rgba(168,85,247,0.4)] bg-[rgba(168,85,247,0.12)] p-3 text-[13px] font-semibold text-[#c084fc]"
            >
              🔄 Re-do Comparison
            </button>

            <button
              onClick={onScanDifferentHand}
              className="w-full cursor-pointer rounded-[10px] border border-white/12 bg-white/5 p-3 text-[13px] font-semibold text-dim"
            >
              🖐️ Scan Different Hand
            </button>
          </div>

          <p className={DISCLAIMER}>
            Palmistry is a tool for self-reflection. Insights here are interpretive, not predictive.
          </p>
        </div>
      )}

      <BottomNav activeKey="palm" />
    </div>
  );
}
