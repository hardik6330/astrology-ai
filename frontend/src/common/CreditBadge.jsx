import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useCredits } from "./useCredits";
import { getCredits } from "@/services/api";
import { Icon } from "@/utils/icons";

// Low-balance threshold — mirrors the priciest single action (insights/palm),
// below which the user can't afford every feature.
const LOW = 20;

// Routes that don't show the badge. The home page is the pre-profile birth
// form — keying the fetch off the form there fired a /credits call on every
// keystroke, and there's no balance worth showing before the chart exists.
// Login is pre-auth; admin has its own chrome.
const isHidden = (path) => path === "/" || path.startsWith("/login") || path.startsWith("/admin");

// Floating "sparkle credits" badge. Hidden on the home/form + auth screens; on the
// reading/chat/palm/credits pages it fetches the balance once on entry and then
// re-renders live as AI actions update the shared store.
export default function CreditBadge() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const hidden = isHidden(pathname);
  const credits = useCredits();

  useEffect(() => {
    if (hidden) return; // no fetch on the form/login/admin pages
    getCredits(); // fetch once when landing on a page that shows the badge
  }, [hidden, pathname]);

  if (hidden || credits == null) return null;
  const low = credits < LOW;

  return (
    <button
      type="button"
      onClick={() => navigate("/credits")}
      className={`fixed top-3 right-3 z-50 inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-bold shadow-[0_4px_16px_rgba(0,0,0,0.35)] backdrop-blur-sm ${
        low
          ? "border-[rgba(248,113,113,0.5)] bg-[rgba(248,113,113,0.15)] text-danger"
          : "border-[rgba(168,85,247,0.45)] bg-[rgba(168,85,247,0.15)] text-[#c084fc]"
      }`}
      title={low ? "Low balance — tap to buy credits" : "Cosmic Credits — tap to buy more"}
    >
      <Icon name="SPARKLES" size={14} />
      <span>{credits}</span>
      {low && <span className="text-[10px] font-semibold tracking-wide uppercase opacity-90">Low</span>}
    </button>
  );
}
