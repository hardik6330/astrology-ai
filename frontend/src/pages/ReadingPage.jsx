import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MSGS } from "@/shared/prompts";
import { fetchSaved } from "../services/api";
import { useChart } from "../context/ChartContext";
import BottomNav from "../components/BottomNav";
import Card from "@/common/Card";
import KundaliTab from "@/features/reading/KundaliTab";
import PlanetsTab from "@/features/reading/PlanetsTab";
import TimelineTab from "@/features/reading/TimelineTab";
import InsightsTab from "@/features/reading/InsightsTab";

import { Icon } from "@/utils/icons";

// Protected results page — owns the AI-reading lifecycle and tab state, then
// delegates each tab's body to a dedicated component in features/reading/.
export default function ReadingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // The insight generation lifecycle is owned by ChartContext so it survives
  // navigating away from the reading tab mid-generation (it keeps running and
  // the result lands in `interp` whenever it resolves).
  const {
    form,
    chart,
    interp,
    setInterp,
    insightLoading,
    insightOverloaded,
    insightLowCredits,
    insightError,
    setInsightLowCredits,
    generateInsight,
  } = useChart();

  // Default to the tab passed via navigation state (e.g. from BottomNav on /palm).
  const [tab, setTab] = useState(() => location.state?.tab || "kundali");

  // If we land here from elsewhere with a {state:{tab}} payload, honor it.
  useEffect(() => {
    if (location.state?.tab) setTab(location.state.tab);
  }, [location.state]);

  const [loadMsg, setLoadMsg] = useState(MSGS[0]);
  const [progress, setProgress] = useState(0); // time-estimated generation %
  const [error, setError] = useState(""); // local errors (e.g. KundaliTab)
  const [cooldown, setCooldown] = useState(0); // seconds until retry is allowed
  const fetched = useRef(false);

  // Frozen "current instant" so dasha progress bars are stable across renders.
  const [now] = useState(() => Date.now());

  // On mount, load ONLY a previously-unlocked interpretation (a free GET).
  // We never auto-generate: generating costs credits, so it must be triggered
  // explicitly via the Unlock button below. Skip while a generation is in flight.
  useEffect(() => {
    if (!chart || interp || insightLoading || fetched.current) return;
    fetched.current = true;
    fetchSaved("interpret", form)
      .then((saved) => {
        if (saved) setInterp(saved);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart, interp, insightLoading, form]);

  // Drive a single time-based progress estimate while a generation is in
  // flight, and derive the status message from it so the bar and the text never
  // disagree. The bar eases asymptotically toward ~92% (fast at first, slowing
  // as it nears the cap) — we never assert 100% until the result actually lands
  // and this loading view unmounts. Runs off the context flag so re-entering the
  // page mid-generation resumes the estimate.
  useEffect(() => {
    if (!insightLoading) {
      setProgress(0);
      return;
    }
    const start = Date.now();
    setProgress(4);
    setLoadMsg(MSGS[0]);
    const iv = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const pct = Math.min(92, Math.round(100 * (1 - Math.exp(-elapsed / 11))));
      setProgress(pct);
      // Map the estimate onto the 5 pipeline stages (thresholds mirror STEP_AT
      // in InsightsTab) so the headline message tracks the checklist.
      const step = pct < 20 ? 0 : pct < 42 ? 1 : pct < 64 ? 2 : pct < 86 ? 3 : 4;
      setLoadMsg(MSGS[step]);
    }, 250);
    return () => clearInterval(iv);
  }, [insightLoading]);

  // Start the retry cooldown whenever the AI reports overloaded.
  useEffect(() => {
    if (insightOverloaded) setCooldown(40);
  }, [insightOverloaded]);

  // Cooldown tick — disables the retry button so users can't spam Pro
  // while it's overloaded.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // After a 402, show the "not enough credits" card for 5s, then fall back to
  // the unlock card so the user can try again once they've topped up.
  useEffect(() => {
    if (!insightLowCredits) return;
    const id = setTimeout(() => setInsightLowCredits(false), 5000);
    return () => clearTimeout(id);
  }, [insightLowCredits, setInsightLowCredits]);

  return (
    <div className="relative mx-auto max-w-180 px-4 pt-8 pb-30">
      {(error || insightError) && (
        <Card style={{ borderColor: "#ef4444", background: "rgba(239, 68, 68, 0.1)" }}>
          <p className="m-0 inline-flex items-center gap-1.5 text-sm text-danger">
            <Icon name="WARNING" size={14} className="text-danger" /> {error || insightError}
          </p>
        </Card>
      )}

      <div className="animate-[slideUp_0.8s_ease-out]">
        <div className="mb-6 text-center">
          <p className="text-[13px] font-semibold tracking-[1px] text-accent uppercase">
            {form.name || "Seeker"}'s Cosmic Map
          </p>
          <p className="mt-1 text-xs text-[#888]">
            {form.date} • {form.time} • {form.city}
          </p>
        </div>

        {tab === "kundali" && <KundaliTab chart={chart} form={form} onError={setError} />}
        {tab === "planets" && <PlanetsTab chart={chart} now={now} />}
        {tab === "timeline" && <TimelineTab chart={chart} />}
        {tab === "reading" && (
          <InsightsTab
            interp={interp}
            loading={insightLoading}
            loadMsg={loadMsg}
            progress={progress}
            overloaded={insightOverloaded}
            cooldown={cooldown}
            lowCredits={insightLowCredits}
            onUnlock={generateInsight}
            onRetry={generateInsight}
            onOpenChat={() => navigate("/chat")}
          />
        )}
      </div>

      <BottomNav activeKey={tab} onLocalTab={setTab} />
    </div>
  );
}
