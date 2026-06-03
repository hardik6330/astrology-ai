import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { buildFactSheet } from "@/shared/astrology";
import { MSGS } from "@/shared/prompts";
import { chatCompletionJSON, fetchSaved } from "../services/api";
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
  const { form, chart, interp, setInterp } = useChart();

  // Default to the tab passed via navigation state (e.g. from BottomNav on /palm).
  const [tab, setTab] = useState(() => location.state?.tab || "kundali");

  // If we land here from elsewhere with a {state:{tab}} payload, honor it.
  useEffect(() => {
    if (location.state?.tab) setTab(location.state.tab);
  }, [location.state]);

  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState(MSGS[0]);
  const [error, setError] = useState("");
  const [overloaded, setOverloaded] = useState(false); // AI tried 3× and gave up
  const [cooldown, setCooldown] = useState(0); // seconds until retry is allowed
  const fetched = useRef(false);

  // Frozen "current instant" so dasha progress bars are stable across renders.
  const [now] = useState(() => Date.now());

  // Generate the AI interpretation once when the page first mounts.
  // generateReading() is also called by the retry button when the AI was overloaded.
  async function generateReading() {
    if (!chart) return;
    setError("");
    setOverloaded(false);
    let mi = 0;
    setLoading(true);
    setLoadMsg(MSGS[0]);
    const iv = setInterval(() => {
      mi++;
      setLoadMsg(MSGS[mi % MSGS.length]);
    }, 2000);
    try {
      const saved = await fetchSaved("interpret", form);
      setInterp(
        saved || (await chatCompletionJSON([], "interpret", { factSheet: buildFactSheet(chart, form), form }))
      );
    } catch (e) {
      if (e.code === "AI_OVERLOADED") {
        setOverloaded(true);
        setCooldown(40);
      } else setError(e.message);
    } finally {
      clearInterval(iv);
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!chart || interp || fetched.current) return;
    fetched.current = true;
    generateReading();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart, interp, form]);

  // Cooldown tick — disables the retry button so users can't spam Pro
  // while it's overloaded.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  return (
    <div className="relative mx-auto max-w-180 px-4 pt-8 pb-30">
      <div className="cosmos"></div>
      <div className="stars"></div>
      <div className="shooting-star"></div>

      <button
        onClick={() => navigate("/", { state: { edit: true } })}
        className="mb-5 cursor-pointer rounded-lg border border-[rgba(99,102,241,0.4)] bg-[rgba(99,102,241,0.1)] px-4 py-2 text-xs text-[#a5b4fc]"
      >
        ← New Reading
      </button>

      {error && (
        <Card style={{ borderColor: "#ef4444", background: "rgba(239, 68, 68, 0.1)" }}>
          <p className="m-0 text-sm text-danger">
            {EMOJIS.WARNING} {error}
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
            loading={loading}
            loadMsg={loadMsg}
            overloaded={overloaded}
            cooldown={cooldown}
            onRetry={generateReading}
            onOpenChat={() => navigate("/chat")}
          />
        )}
      </div>

      <BottomNav activeKey={tab} onLocalTab={setTab} />
    </div>
  );
}
