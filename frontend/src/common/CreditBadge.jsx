import { useEffect } from "react";
import { useChart } from "@/context/ChartContext";
import { useCredits } from "./useCredits";
import { getCredits } from "@/services/api";

// Low-balance threshold — mirrors the priciest single action (insights/palm),
// below which the user can't afford every feature.
const LOW = 20;

// Floating "✨ credits" badge. Self-contained: pulls the active profile from
// ChartContext, refreshes the balance from the server when that profile
// changes, and re-renders live as AI actions update the shared store.
// Renders nothing until a balance is known (logged-out / no profile).
export default function CreditBadge() {
  const { form } = useChart();
  const credits = useCredits();

  useEffect(() => {
    getCredits(); // resolves the user from the token; no-ops when logged out
    // Re-fetch when the profile changes — covers login populating the saved
    // form, and switching/editing birth details.
  }, [form?.name, form?.date, form?.time, form?.city]);

  if (credits == null) return null;
  const low = credits < LOW;

  return (
    <div
      className={`fixed top-3 right-3 z-50 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-bold shadow-[0_4px_16px_rgba(0,0,0,0.35)] backdrop-blur-sm ${
        low
          ? "border-[rgba(248,113,113,0.5)] bg-[rgba(248,113,113,0.15)] text-danger"
          : "border-[rgba(168,85,247,0.45)] bg-[rgba(168,85,247,0.15)] text-[#c084fc]"
      }`}
      title={low ? "Low balance — top up to keep using AI features" : "Cosmic Credits"}
    >
      <span>✨</span>
      <span>{credits}</span>
      {low && <span className="text-[10px] font-semibold tracking-wide uppercase opacity-90">Low</span>}
    </div>
  );
}
