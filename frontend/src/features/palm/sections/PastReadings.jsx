// "Your Past Readings" list — tap to re-view a saved reading, no AI re-run.

import Card from "@/common/Card";

export default function PastReadings({ history, onLoad }) {
  return (
    <Card>
      <p className="mx-0 mt-0 mb-1 text-sm font-semibold text-ink">📂 Your Past Readings</p>
      <p className="mx-0 mt-0 mb-3.5 text-[11px] text-muted">Tap to view — no AI re-run.</p>
      <div className="grid gap-2">
        {history.map((h) => {
          const d = new Date(h.createdAt);
          const when =
            d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
            ", " +
            d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
          const bad = h.imageQuality === "unusable";
          return (
            <button
              key={h.id}
              onClick={() => onLoad(h.id)}
              disabled={bad}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[rgba(168,85,247,0.25)] bg-[rgba(168,85,247,0.06)] px-3.5 py-2.5 text-left"
              // Disabled (unreadable) state recolors text + dims → inline.
              style={{
                cursor: bad ? "not-allowed" : "pointer",
                color: bad ? "#475569" : "#e2e8f0",
                opacity: bad ? 0.6 : 1,
              }}
            >
              <span className="min-w-0 text-[13px] font-semibold">
                🖐️ {h.handType || "Unclear"} Hand
                {bad && <span className="ml-2 text-[10px] text-danger">· unreadable</span>}
              </span>
              <span className="text-[11px] whitespace-nowrap text-muted">{when}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
