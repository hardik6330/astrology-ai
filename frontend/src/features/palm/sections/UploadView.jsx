// Upload card (hand pick + hidden file inputs) and the scanning animation.
// Pure presentation — all state and handlers live in PalmPage.

import Card from "@/common/Card";
import PalmSkeletonOverlay from "./PalmSkeletonOverlay";

export default function UploadView({
  preview,
  scanning,
  scanMsg,
  claimedHand,
  palmLandmarks,
  error,
  gating,
  cannotAfford,
  palmCost,
  hasCamera,
  pickForHand,
  onPick,
  onCompare,
  fileRef,
  cameraRef,
}) {
  return (
    <Card className="text-center" style={{ padding: "2rem 1.25rem" }}>
      {!preview && !scanning && (
        <>
          <div className="astrology-icon" style={{ fontSize: 56, marginBottom: 12 }}>
            🖐️
          </div>
          <p className="mx-0 mt-0 mb-1.5 text-[15px] font-semibold text-ink">Scan Your Palm</p>
          <p className="mx-0 mt-0 mb-3 text-xs leading-[1.6] text-dim">
            Pick which hand you're uploading. We'll check the photo matches the hand you choose.
          </p>
          {/* Cost reminder — palm reading is a charged AI action. */}
          <div className="mx-auto mb-4 inline-flex items-center gap-1.5 rounded-full border border-[rgba(168,85,247,0.4)] bg-[rgba(168,85,247,0.12)] px-3 py-1 text-[11.5px] font-semibold text-[#c084fc]">
            ✨ {palmCost} credits per reading
          </div>
          <div className="grid gap-2.5">
            {[
              ["Right", "✋"],
              ["Left", "🤚"],
            ].map(([hand, icon]) => (
              <button
                key={hand}
                onClick={() => pickForHand(hand)}
                disabled={gating || cannotAfford}
                className="flex w-full items-center gap-3.5 rounded-xl border border-[rgba(168,85,247,0.35)] bg-[rgba(168,85,247,0.08)] px-4 py-3.5 text-left text-ink"
                style={{
                  cursor: gating || cannotAfford ? "not-allowed" : "pointer",
                  opacity: gating || cannotAfford ? 0.5 : 1,
                }}
              >
                <span className="w-8 text-center text-[26px]">{icon}</span>
                <span className="flex-1">
                  <strong className="block text-sm">{hand} Hand</strong>
                  <span className="text-xs text-dim">
                    {hasCamera
                      ? "Tap to take or pick a photo"
                      : `Upload a clear photo of your ${hand.toLowerCase()} palm`}
                  </span>
                </span>
                <span className="text-[22px] text-[#a855f7]">›</span>
              </button>
            ))}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onPick}
            className="hidden"
          />

          {/* Premium upsell — both-hands "Full Life Comparison". */}
          <button
            onClick={onCompare}
            disabled={cannotAfford}
            className="mt-3.5 w-full cursor-pointer rounded-[10px] border border-[rgba(192,132,252,0.4)] bg-[linear-gradient(135deg,rgba(168,85,247,0.10),rgba(99,102,241,0.10))] px-3 py-2.5 text-[12.5px] font-semibold text-[#c4b5fd] disabled:cursor-not-allowed disabled:opacity-50"
          >
            ✋🤚 Compare Both Hands · Full Life Reading · {palmCost} Credits →
          </button>

          {gating && <p className="mx-0 mt-3 mb-0 text-center text-[13px] text-dim">Reading photo…</p>}

          {error && (
            <p className="mt-3 animate-[slideUp_0.3s_ease-out] text-center text-[13px] text-danger">
              {error}
            </p>
          )}
        </>
      )}

      {preview && scanning && (
        <>
          {claimedHand && (
            <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-[rgba(168,85,247,0.5)] bg-[rgba(168,85,247,0.12)] px-3.5 py-1.5 text-xs font-bold tracking-[1.5px] text-[#c4b5fd] uppercase">
              <span className="text-sm">{claimedHand === "Right" ? "✋" : "🤚"}</span>
              {claimedHand} Hand
            </div>
          )}
          <div className="relative mx-auto mb-4.5 w-full max-w-80 overflow-hidden rounded-2xl border border-[rgba(168,85,247,0.4)] shadow-[0_0_30px_rgba(168,85,247,0.25)]">
            <img src={preview} alt="palm" className="block w-full" />
            {/* detected hand skeleton (landmarks + bones), pinned on the photo */}
            <PalmSkeletonOverlay landmarks={palmLandmarks} />
            {/* sweeping scan line */}
            <div
              className="absolute top-0 right-0 left-0 h-[3px] bg-[linear-gradient(90deg,transparent,#c084fc,transparent)] shadow-[0_0_18px_4px_rgba(192,132,252,0.6)]"
              style={{ animation: "palmScan 1.8s ease-in-out infinite" }}
            />
            {/* dotted overlay */}
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: "radial-gradient(rgba(168,85,247,0.18) 1px, transparent 1px)",
                backgroundSize: "14px 14px",
                mixBlendMode: "screen",
              }}
            />
          </div>
          <p className="m-0 text-sm font-semibold text-[#c084fc]">{scanMsg}</p>
          <p className="mt-1.5 text-[11px] text-muted">This usually takes 10–30 seconds.</p>
          <style>{`@keyframes palmScan { 0%{top:0} 50%{top:calc(100% - 3px)} 100%{top:0} }`}</style>
        </>
      )}
    </Card>
  );
}
