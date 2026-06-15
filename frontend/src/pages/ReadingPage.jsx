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

import { EMOJIS } from "@/utils/emojis";

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

  // Rotate the loading messages while a generation is in flight. Runs off the
  // context flag so re-entering the page mid-generation restarts the rotation.
  useEffect(() => {
    if (!insightLoading) return;
    setLoadMsg(MSGS[0]);
    let mi = 0;
    const iv = setInterval(() => {
      mi++;
      setLoadMsg(MSGS[mi % MSGS.length]);
    }, 2000);
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
      <div className="cosmos"></div>
      <div className="stars"></div>
      <div className="shooting-star"></div>

      {(error || insightError) && (
        <Card style={{ borderColor: "#ef4444", background: "rgba(239, 68, 68, 0.1)" }}>
          <p className="m-0 text-sm text-danger">
            {EMOJIS.WARNING} {error || insightError}
          </p>
        </Card>
      )}

      <div className="animate-[slideUp_0.8s_ease-out]">
        <div className="mb-6 text-center">
          <p className="text-[13px] font-semibold tracking-[1px] text-accent uppercase">
            {form.name || "Seeker"}'s Cosmic Map
          </p>
          <p className="mt-1 text-xs text-[#888]">
            {form.dob} • {form.time} • {form.city}
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
