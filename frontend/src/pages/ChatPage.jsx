import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useChart } from "@/context/ChartContext";
import { useChatHistory, useSendChatMessage } from "@/features/chat/hooks";
import Card from "@/common/Card";
import { useCosts } from "@/common/useCosts";
import { useCredits } from "@/common/useCredits";
import LowCreditsCard from "@/common/LowCreditsCard";

import { EMOJIS } from "@/utils/emojis";

const SUGGESTIONS = [
  "When will I marry?",
  "How is my career future?",
  "What does my current dasha mean?",
  "Will I settle abroad?",
];

// Protected page — follow-up Q&A locked to the generated birth chart.
// Fixed-height layout: only the message list scrolls, header and input stay put.
export default function ChatPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { form, chart, chatMsgs, setChatMsgs } = useChart();
  const [chatInput, setChatInput] = useState("");
  const [phIdx, setPhIdx] = useState(0);
  const [phText, setPhText] = useState("");
  const [lowCredits, setLowCredits] = useState(false); // 402 on send
  const scrollRef = useRef(null);

  const { data: savedHistory } = useChatHistory(form);
  const sendMessage = useSendChatMessage({ form, chart });
  const chatBusy = sendMessage.isPending;
  const costs = useCosts();
  const chatCost = costs?.chat ?? 5;
  const credits = useCredits();
  // Block sending once the balance can't cover one message (or after a 402).
  const cannotAfford = lowCredits || (credits != null && credits < chatCost);

  const PLACEHOLDERS = [
    "Ask about your future…",
    "When will I marry?",
    "How is my career going?",
    "What does my dasha say?",
    "Is this a good time for change?",
  ];

  useEffect(() => {
    const full = PLACEHOLDERS[phIdx];
    let i = 0,
      deleting = false,
      t;
    const tick = () => {
      if (!deleting) {
        i++;
        setPhText(full.slice(0, i));
        if (i >= full.length) {
          deleting = true;
          t = setTimeout(tick, 1400);
          return;
        }
        t = setTimeout(tick, 55);
      } else {
        i--;
        setPhText(full.slice(0, i));
        if (i <= 0) {
          setPhIdx((p) => (p + 1) % PLACEHOLDERS.length);
          return;
        }
        t = setTimeout(tick, 30);
      }
    };
    t = setTimeout(tick, 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phIdx]);

  // Shown as the first astrologer message before any conversation starts
  // (display-only — not stored in the database).
  const welcomeMsg =
    `Namaste ${form.name || "there"} ${EMOJIS.NAMASTE} I'm your personal Vedic astrologer. ` +
    `Ask me anything about your life — career, marriage, money, health, timing — and ` +
    `I'll answer from your kundali. What would you like to know?`;

  // keep the message list pinned to the latest message
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatMsgs]);

  // Hydrate in-memory conversation from the server copy on first load.
  useEffect(() => {
    if (chatMsgs.length === 0 && savedHistory?.length) {
      setChatMsgs(savedHistory);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedHistory]);

  // Deep-link: arriving with location.state.ask = "<question>" (the bi-wheel
  // alignment "Ask" button) auto-sends it once the chart is ready, then clears
  // the router state so a refresh/back won't resend the same question.
  const askedRef = useRef(null);
  useEffect(() => {
    const preset = location.state?.ask;
    if (!preset) {
      askedRef.current = null;
      return;
    }
    if (askedRef.current === preset || !chart) return;
    askedRef.current = preset;
    navigate(".", { replace: true, state: {} }); // clear so it fires once
    askChat(preset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, chart]);

  async function askChat(presetOrEvent) {
    // `preset` (a string) lets callers send a question without it living in the
    // input box first — e.g. the bi-wheel alignment "Ask" deep-link below.
    if (presetOrEvent && typeof presetOrEvent.preventDefault === "function") presetOrEvent.preventDefault();
    const preset = typeof presetOrEvent === "string" ? presetOrEvent : null;
    const q = (preset ?? chatInput).trim();
    if (!q || chatBusy || !chart || cannotAfford) return;
    setChatInput("");
    setLowCredits(false);
    const history = [...chatMsgs, { role: "user", content: q }];
    setChatMsgs([...history, { role: "assistant", content: "…" }]);

    try {
      // Compact fact sheet (not the full chart JSON) keeps token use down.
      const txt = await sendMessage.mutateAsync(history);
      const reply = txt || "(no response)";
      setChatMsgs((m) => {
        const c = m.slice();
        c[c.length - 1] = { role: "assistant", content: reply };
        return c;
      });
    } catch (err) {
      if (err.code === "INSUFFICIENT_CREDITS") {
        // Drop the "…" placeholder and the user turn; surface the credit card.
        setChatMsgs((m) => m.slice(0, -2));
        setChatInput(q); // give the question back so they can resend after topping up
        setLowCredits(true);
        return;
      }
      setChatMsgs((m) => {
        const c = m.slice();
        c[c.length - 1] = { role: "assistant", content: "Error: " + err.message };
        return c;
      });
    }
  }

  return (
    <div className="full-screen relative flex flex-col">
      <div className="cosmos"></div>
      <div className="stars"></div>

      {/* Fixed inner column — header and input stay, only messages scroll */}
      <div className="mx-auto flex w-full max-w-180 min-h-0 flex-1 flex-col p-4">
        {/* Header (fixed) */}
        <div className="shrink-0">
          <button
            onClick={() => navigate("/reading")}
            className="mb-3 cursor-pointer rounded-lg border border-[rgba(99,102,241,0.4)] bg-[rgba(99,102,241,0.1)] px-4 py-2 text-xs text-[#a5b4fc]"
          >
            {EMOJIS.LEFT_ARROW} Back to Reading
          </button>
          {/* cosmic-card padding/margin overridden inline (unlayered). */}
          <Card className="text-center" style={{ marginBottom: 12, padding: "1rem" }}>
            <h2 className="m-0 mb-1 bg-linear-to-r from-white to-[#a855f7] bg-clip-text text-[22px] font-bold text-transparent">
              {EMOJIS.CHAT} Ask About Your Kundli
            </h2>
            <p className="m-0 text-xs text-[#aaa]">
              {form.name ? `${form.name}'s chart` : "Your chart"} · answered from your birth chart only
            </p>
          </Card>
        </div>

        {/* Message list (the ONLY scrolling area) */}
        <div
          ref={scrollRef}
          className="hide-scrollbar flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-1 py-3"
        >
          {[{ role: "assistant", content: welcomeMsg }, ...chatMsgs].map((m, i) => {
            const isUser = m.role === "user";
            const avatar = (
              // bg/border are role-driven → inline; shape/size → utilities.
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-base"
                style={{
                  background: isUser ? "rgba(99,102,241,0.25)" : "rgba(168,85,247,0.2)",
                  borderColor: isUser ? "rgba(99,102,241,0.5)" : "rgba(168,85,247,0.45)",
                }}
              >
                {isUser ? EMOJIS.PERSON : EMOJIS.CRYSTAL_BALL}
              </div>
            );
            return (
              <div key={i} className={`flex w-full items-start gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
                {avatar}
                <div
                  className="max-w-[78%] rounded-[14px] border px-3.5 py-2.5 text-[13.5px] leading-[1.65] whitespace-pre-wrap"
                  style={{
                    background: isUser ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.04)",
                    borderColor: isUser ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.08)",
                    color: isUser ? "#e0e7ff" : "#cbd5e1",
                  }}
                >
                  {m.content}
                </div>
              </div>
            );
          })}
        </div>

        {/* Input + suggestions (fixed) */}
        <div className="shrink-0 pt-2">
          {chatMsgs.length === 0 && (
            <div className="mb-2.5 flex flex-wrap gap-2">
              {SUGGESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => setChatInput(q)}
                  className="cursor-pointer rounded-2xl border border-[rgba(168,85,247,0.3)] bg-[rgba(168,85,247,0.08)] px-3 py-1.5 text-xs text-[#a5b4fc]"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
          {cannotAfford && (
            <div className="mb-2.5">
              <LowCreditsCard cost={chatCost} action="Each chat message" />
            </div>
          )}
          <p className="mx-1 mb-1.5 text-center text-[10.5px] text-muted">
            {EMOJIS.SPARKLES} {chatCost} credits per message
          </p>
          <form onSubmit={askChat} className="flex gap-2">
            <input
              className="premium-input flex-1 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder={cannotAfford ? "Out of credits — top up to chat" : phText + "▍"}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={chatBusy || cannotAfford}
            />
            <button
              type="submit"
              disabled={chatBusy || cannotAfford || !chatInput.trim()}
              className="cursor-pointer rounded-[10px] border border-[rgba(168,85,247,0.4)] bg-[rgba(168,85,247,0.15)] px-5 py-2.5 text-[13px] font-semibold text-[#c084fc] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {chatBusy ? "…" : "Ask"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
