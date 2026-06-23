// AI-chat motifs for the landing: a compact hero preview and a fuller demo
// window for the dedicated astrologer section. Both are illustrative.
import { useEffect, useState } from "react";
import { LuSparkles, LuListChecks, LuArrowRight } from "react-icons/lu";
import { BENTO_CHAT } from "./data";

// Hero preview rotates through these Q&A pairs so it reads as a live product
// rather than one frozen exchange. Each shows the question, a grounded answer,
// and the evidence chips behind it.
const PREVIEW_CONVOS = [
  {
    q: "Will my career improve this year?",
    a: "Saturn is maturing in your 10th house through 2026 — this favours steady, earned progress over sudden leaps.",
    chips: ["Saturn", "10th house", "Capricorn"],
  },
  {
    q: "When will I meet someone serious?",
    a: "Venus brightens your 7th house from spring — bonds formed in that window tend to last.",
    chips: ["Venus", "7th house", "Libra"],
  },
  {
    q: "Is this a good time to invest?",
    a: "Jupiter supports your 2nd house of wealth, but hold until Mercury turns direct next week.",
    chips: ["Jupiter", "2nd house", "Mercury"],
  },
  {
    q: "Which day this week is best to travel?",
    a: "Your Moon is well-placed midweek — Thursday is your smoothest window for a journey.",
    chips: ["Moon", "3rd house", "Gemini"],
  },
];

// ── Hero chat preview: a compact glass panel that cycles through PREVIEW_CONVOS,
// re-triggering the bubble rise on each turn. Holds still under reduced-motion.
export function ChatPreview() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % PREVIEW_CONVOS.length), 4500);
    return () => clearInterval(id);
  }, []);

  const convo = PREVIEW_CONVOS[idx];

  return (
    <div className="relative w-[min(420px,100%)]">
      <div
        aria-hidden="true"
        className="absolute -inset-6 -z-10 rounded-[2.5rem] blur-2xl"
        style={{ background: "radial-gradient(circle, rgba(139,92,246,0.4), transparent 70%)" }}
      />
      <div
        className="rounded-[1.8rem] border border-white/12 bg-[#0b0b16]/80 p-5 backdrop-blur-md"
        style={{ boxShadow: "0 30px 80px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.05)" }}
      >
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full"
            style={{ background: "var(--grad-primary)" }}
          >
            <LuSparkles className="text-sm text-ink" />
          </span>
          <span className="text-sm font-bold">Selora AI</span>
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> online
          </span>
        </div>

        {/* key={idx} remounts the block each cycle so the chat-rise replays. The
            min-height keeps the panel from jumping as answer length changes. */}
        <div key={idx} className="space-y-3 pt-4" style={{ minHeight: 196 }}>
          <div
            className="chat-rise ml-auto w-fit max-w-[82%] rounded-2xl rounded-br-sm bg-white/[0.08] px-3.5 py-2 text-sm text-body"
            style={{ animationDelay: ".1s" }}
          >
            {convo.q}
          </div>
          <div
            className="chat-rise w-fit max-w-[90%] rounded-2xl rounded-bl-sm bg-[rgba(139,92,246,0.16)] px-3.5 py-2.5 text-sm text-ink"
            style={{ animationDelay: ".55s" }}
          >
            {convo.a}
          </div>
          <div className="chat-rise flex flex-wrap gap-1.5" style={{ animationDelay: "1s" }}>
            {convo.chips.map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--c-border)] bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-subtle"
              >
                <LuListChecks size={11} className="text-[#c084fc]" /> {c}
              </span>
            ))}
          </div>
        </div>

        {/* Dots show which exchange is on screen. */}
        <div className="mt-4 flex items-center gap-1.5" aria-hidden="true">
          {PREVIEW_CONVOS.map((_, i) => (
            <span
              key={i}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === idx ? 16 : 6,
                background: i === idx ? "var(--grad-primary)" : "rgba(255,255,255,0.2)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Animated thread for the large "AI Astrologer Chat" bento tile. Plays the
// BENTO_CHAT conversation live: a user question appears, the AI "thinks" (typing
// dots), then answers, then the next question — looping. Holds the full thread
// static under reduced-motion.
export function BentoChatThread() {
  const reduce =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const VISIBLE = 5; // sliding window — only the latest few turns stay on screen
  const [count, setCount] = useState(reduce ? BENTO_CHAT.length : 0); // turns played
  const [typing, setTyping] = useState(null); // null | "me" (user side) | "ai" (left)

  // Step through the script: EVERY turn first shows a typing indicator on its own
  // side (right for the user, left for the AI), then the bubble lands. The user
  // "types" briefly; the AI "thinks" a little longer. Restarts after the end.
  useEffect(() => {
    if (reduce) return;
    let cancelled = false;
    let timer;
    const run = (n) => {
      if (cancelled) return;
      if (n >= BENTO_CHAT.length) {
        timer = setTimeout(() => {
          if (cancelled) return;
          setCount(0);
          run(0);
        }, 4200);
        return;
      }
      const isUser = BENTO_CHAT[n].me;
      setTyping(isUser ? "me" : "ai");
      timer = setTimeout(
        () => {
          if (cancelled) return;
          setTyping(null);
          setCount(n + 1);
          timer = setTimeout(() => run(n + 1), 450); // small beat before the next turn
        },
        isUser ? 850 : 1500
      );
    };
    timer = setTimeout(() => run(0), 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [reduce]);

  // Bottom-anchored fixed window: newest turns sit at the bottom and push older
  // ones up; only the last VISIBLE stay rendered, so there's no scrollbar and the
  // oldest fades out at the top edge.
  const start = Math.max(0, count - VISIBLE);

  return (
    <div className="mask-fade-t mt-6 flex h-[286px] flex-col justify-end gap-2.5 overflow-hidden">
      {BENTO_CHAT.slice(start, count).map((m, idx) => {
        const i = start + idx;
        return (
          <div
            key={i}
            className={`chat-rise w-fit px-3.5 py-2 text-xs ${
              m.me
                ? "ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-white/[0.07] text-body"
                : "max-w-[88%] rounded-2xl rounded-bl-sm bg-[rgba(139,92,246,0.16)] text-ink"
            }`}
          >
            {m.t}
          </div>
        );
      })}
      {typing && (
        <div
          className={`chat-rise flex w-fit items-center gap-1 px-3.5 py-2.5 ${
            typing === "me"
              ? "ml-auto rounded-2xl rounded-br-sm bg-white/[0.07]"
              : "rounded-2xl rounded-bl-sm bg-[rgba(139,92,246,0.16)]"
          }`}
          aria-hidden="true"
        >
          <span
            className="typing-dot"
            style={typing === "me" ? { background: "rgba(255,255,255,0.55)" } : undefined}
          />
          <span
            className="typing-dot"
            style={{
              animationDelay: ".18s",
              ...(typing === "me" ? { background: "rgba(255,255,255,0.55)" } : {}),
            }}
          />
          <span
            className="typing-dot"
            style={{
              animationDelay: ".36s",
              ...(typing === "me" ? { background: "rgba(255,255,255,0.55)" } : {}),
            }}
          />
        </div>
      )}
    </div>
  );
}

// ── Fuller AI chat window for the dedicated astrologer section.
export function AstrologerDemo() {
  const turns = [
    { me: true, t: "Is this a good time to start something new?" },
    {
      me: false,
      t: "Your Moon is well-placed this week and Jupiter aspects your 1st house — a supportive window for fresh starts, especially before the weekend.",
    },
    { me: true, t: "What should I be careful about?" },
    {
      me: false,
      t: "Avoid signing anything during your Rahu Kaal window. I've flagged it in today's guidance.",
    },
  ];
  return (
    <div
      className="overflow-hidden rounded-3xl border border-white/12 bg-[#0b0b16]/80 backdrop-blur-md"
      style={{ boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }}
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3.5">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full"
          style={{ background: "var(--grad-primary)" }}
        >
          <LuSparkles className="text-sm text-ink" />
        </span>
        <span className="text-sm font-bold">Selora AI Astrologer</span>
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-success">
          <span className="h-1.5 w-1.5 rounded-full bg-success" /> grounded in your chart
        </span>
      </div>
      <div className="space-y-3 px-5 py-5">
        {turns.map((m, i) => (
          <div
            key={i}
            className={`chat-rise w-fit max-w-[85%] px-3.5 py-2.5 text-sm ${
              m.me
                ? "ml-auto rounded-2xl rounded-br-sm bg-white/[0.08] text-body"
                : "rounded-2xl rounded-bl-sm bg-[rgba(139,92,246,0.16)] text-ink"
            }`}
            style={{ animationDelay: `${0.15 + i * 0.35}s` }}
          >
            {m.t}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 border-t border-white/10 px-5 py-3.5">
        <div className="flex-1 rounded-full border border-[var(--c-border)] bg-white/[0.03] px-4 py-2 text-sm text-dim">
          Ask about career, love, money, timing…
        </div>
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ background: "var(--grad-primary)" }}
        >
          <LuArrowRight className="text-ink" />
        </span>
      </div>
    </div>
  );
}
