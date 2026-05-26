import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { chatCompletion, fetchChatHistory } from "../services/api";
import { buildFactSheet } from "../astrology";
import { useChart } from "../context/ChartContext";

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
  const { form, chart, chatMsgs, setChatMsgs } = useChart();
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [phIdx, setPhIdx]   = useState(0);
  const [phText, setPhText] = useState("");
  const scrollRef = useRef(null);

  const PLACEHOLDERS = [
    "Ask about your future…",
    "When will I marry?",
    "How is my career going?",
    "What does my dasha say?",
    "Is this a good time for change?",
  ];

  useEffect(() => {
    const full = PLACEHOLDERS[phIdx];
    let i = 0, deleting = false, t;
    const tick = () => {
      if (!deleting) {
        i++;
        setPhText(full.slice(0, i));
        if (i >= full.length) { deleting = true; t = setTimeout(tick, 1400); return; }
        t = setTimeout(tick, 55);
      } else {
        i--;
        setPhText(full.slice(0, i));
        if (i <= 0) { setPhIdx((p) => (p + 1) % PLACEHOLDERS.length); return; }
        t = setTimeout(tick, 30);
      }
    };
    t = setTimeout(tick, 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phIdx]);

  // Shown as the first astrologer message before any conversation starts
  // (display-only — not stored in the database).
  const welcomeMsg = `Namaste ${form.name || "there"} 🙏 I'm your personal Vedic astrologer. ` +
    `Ask me anything about your life — career, marriage, money, health, timing — and ` +
    `I'll answer from your kundali. What would you like to know?`;

  // keep the message list pinned to the latest message
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatMsgs]);

  // On first load (e.g. after a refresh) restore this user's saved chat from
  // the backend if the in-memory conversation is empty.
  useEffect(() => {
    if (chatMsgs.length > 0) return;
    fetchChatHistory(form).then(msgs => {
      if (msgs.length) setChatMsgs(msgs);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function askChat(e) {
    if (e) e.preventDefault();
    const q = chatInput.trim();
    if (!q || chatBusy || !chart) return;
    setChatInput("");
    const history = [...chatMsgs, { role: "user", content: q }];
    setChatMsgs([...history, { role: "assistant", content: "…" }]);
    setChatBusy(true);

    try {
      // ── Answer from the birth chart via Backend ──
      // Send the compact fact sheet (not the full chart JSON) to save tokens.
      const txt = await chatCompletion(history, 'chat', { factSheet: buildFactSheet(chart, form), form });
      
      if (!txt) {
        setChatMsgs(m => { const c = m.slice(); c[c.length - 1] = { role: "assistant", content: "(no response)" }; return c; });
      } else {
        setChatMsgs(m => { const c = m.slice(); c[c.length - 1] = { role: "assistant", content: txt }; return c; });
      }
    } catch (err) {
      setChatMsgs(m => { const c = m.slice(); c[c.length - 1] = { role: "assistant", content: "Error: " + err.message }; return c; });
    }
    setChatBusy(false);
  }

  return (
    <div className="full-screen" style={{ display: "flex", flexDirection: "column", position: "relative" }}>
      <div className="cosmos"></div>
      <div className="stars"></div>

      {/* Fixed inner column — header and input stay, only messages scroll */}
      <div style={{
        width: "100%", maxWidth: 720, margin: "0 auto", flex: 1,
        display: "flex", flexDirection: "column", minHeight: 0, padding: "1rem",
      }}>
        {/* Header (fixed) */}
        <div style={{ flexShrink: 0 }}>
          <button onClick={() => navigate("/reading")} style={{
            fontSize: 12, padding: "8px 16px", borderRadius: 8, cursor: "pointer", color: "#a5b4fc",
            border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.1)", marginBottom: 12 }}>
            ← Back to Reading
          </button>
          <div className="cosmic-card" style={{ textAlign: "center", marginBottom: 12, padding: "1rem" }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", background: "linear-gradient(to right, #fff, #a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              💬 Ask About Your Kundli
            </h2>
            <p style={{ fontSize: 12, color: "#aaa", margin: 0 }}>
              {form.name ? `${form.name}'s chart` : "Your chart"} · answered from your birth chart only
            </p>
          </div>
        </div>

        {/* Message list (the ONLY scrolling area) */}
        <div ref={scrollRef} className="hide-scrollbar" style={{
          flex: 1, minHeight: 0, overflowY: "auto",
          display: "flex", flexDirection: "column", gap: 10,
          padding: "12px 4px",
        }}>
          {(chatMsgs.length ? chatMsgs : [{ role: "assistant", content: welcomeMsg }]).map((m, i) => {
            const isUser = m.role === "user";
            const avatar = (
              <div style={{
                flexShrink: 0, width: 32, height: 32, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
                background: isUser ? "rgba(99,102,241,0.25)" : "rgba(168,85,247,0.2)",
                border: "1px solid " + (isUser ? "rgba(99,102,241,0.5)" : "rgba(168,85,247,0.45)"),
              }}>
                {isUser ? "🧑" : "🔮"}
              </div>
            );
            return (
              <div key={i} style={{
                display: "flex", gap: 8, alignItems: "flex-start", width: "100%",
                flexDirection: isUser ? "row-reverse" : "row",
              }}>
                {avatar}
                <div style={{ maxWidth: "78%", fontSize: 13.5, lineHeight: 1.65, padding: "10px 14px", borderRadius: 14, whiteSpace: "pre-wrap",
                  background: isUser ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.04)",
                  border: "1px solid " + (isUser ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.08)"),
                  color: isUser ? "#e0e7ff" : "#cbd5e1" }}>
                  {m.content}
                </div>
              </div>
            );
          })}
        </div>

        {/* Input + suggestions (fixed) */}
        <div style={{ flexShrink: 0, paddingTop: 8 }}>
          {chatMsgs.length === 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
              {SUGGESTIONS.map(q => (
                <button key={q} onClick={() => setChatInput(q)} style={{
                  fontSize: 12, padding: "6px 12px", borderRadius: 16, cursor: "pointer", color: "#a5b4fc",
                  border: "1px solid rgba(168,85,247,0.3)", background: "rgba(168,85,247,0.08)" }}>{q}</button>
              ))}
            </div>
          )}
          <form onSubmit={askChat} style={{ display: "flex", gap: 8 }}>
            <input className="premium-input" style={{ flex: 1 }} placeholder={phText + "▍"}
              value={chatInput} onChange={e => setChatInput(e.target.value)} disabled={chatBusy} />
            <button type="submit" disabled={chatBusy || !chatInput.trim()} style={{
              padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: chatBusy ? "not-allowed" : "pointer",
              border: "1px solid rgba(168,85,247,0.4)", background: "rgba(168,85,247,0.15)", color: "#c084fc",
              opacity: chatBusy ? 0.5 : 1 }}>
              {chatBusy ? "…" : "Ask"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
