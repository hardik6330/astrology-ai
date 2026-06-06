// Live gate diagnostic panel shown under the palm photo while it's analyzed.
// Renders each gate check (from gatePalmImage's `checks` array) as a pill with
// its measured value + a ✓ / ✗, revealed one-by-one. When `analyzing` is true,
// a final spinner row ("Analyzing palm lines with AI…") sits below the checks.
//
// checks = [{ key, ok, label }]  — label already carries the value, e.g.
//   "Lighting OK (150 / 255)", "Palm lines visible (edge score 182)".

function CheckRow({ check, index }) {
  const tone = check.ok
    ? "border-[rgba(34,197,94,0.35)] bg-[rgba(34,197,94,0.08)] text-[#86efac]"
    : "border-[rgba(248,113,113,0.4)] bg-[rgba(248,113,113,0.08)] text-[#fca5a5]";
  return (
    <div
      className={`flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-[13px] font-medium ${tone}`}
      style={{ animation: "checkIn 0.32s ease-out both", animationDelay: `${index * 160}ms` }}
    >
      <span className="text-sm leading-none">{check.ok ? "✓" : "✗"}</span>
      <span>{check.label}</span>
    </div>
  );
}

export default function PalmGateChecklist({ checks = [], analyzing = false }) {
  if (!checks.length && !analyzing) return null;
  return (
    <div className="mx-auto grid w-full max-w-90 gap-2 text-left">
      {checks.map((c, i) => (
        <CheckRow key={c.key} check={c} index={i} />
      ))}

      {analyzing && (
        <div
          className="flex items-center gap-2.5 rounded-lg border border-[rgba(168,85,247,0.35)] bg-[rgba(168,85,247,0.1)] px-3.5 py-2.5 text-[13px] font-medium text-[#c084fc]"
          style={{ animation: "checkIn 0.32s ease-out both", animationDelay: `${checks.length * 160}ms` }}
        >
          <span
            className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border-2 border-[#c084fc] border-t-transparent"
            style={{ animation: "spin 0.7s linear infinite" }}
          />
          <span>Analyzing palm lines with AI…</span>
        </div>
      )}

      <style>{`
        @keyframes checkIn { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  );
}
