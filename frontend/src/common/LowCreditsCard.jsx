import { useNavigate, useLocation } from "react-router-dom";
import { useCredits } from "./useCredits";
import Card from "./Card";
import Button from "./Button";

// Prominent "not enough credits" card — shown whenever a charged AI action is
// rejected with INSUFFICIENT_CREDITS (palm / insights / daily / chat). Reads
// the live balance so the user sees exactly how short they are.
export default function LowCreditsCard({ cost, action = "This reading" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const credits = useCredits();
  // Carry the current screen to /credits so we can drop the user back here right
  // after they top up — no hunting for the feature they were mid-flow on.
  const goBuy = () => navigate("/credits", { state: { returnTo: location.pathname } });
  return (
    <Card
      className="text-center"
      style={{ borderColor: "rgba(248,113,113,0.45)", background: "rgba(248,113,113,0.08)" }}
    >
      <div className="mb-2 text-4xl">✨</div>
      <p className="mx-0 mt-0 mb-1.5 text-[15px] font-semibold text-danger">Not enough credits</p>
      <p className="mx-0 mt-0 mb-3 text-[12.5px] leading-[1.6] text-subtle">
        {action} costs {cost} credits
        {credits != null ? ` — you have ${credits}` : ""}. Top up to continue.
      </p>
      <Button variant="magic" onClick={goBuy} fullWidth>
        Buy Credits
      </Button>
    </Card>
  );
}
