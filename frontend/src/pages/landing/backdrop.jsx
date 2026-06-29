// Fixed cosmic backdrop + all landing-page CSS. Split out of LandingPage so the
// page composition stays readable. Both are decorative and fully reduced-motion-safe.
import { TWINKLE_STARS } from "./data";

// Fixed, GPU-cheap cosmic backdrop: twinkling starfield, drifting nebula blobs,
// a neon perspective-grid horizon, and the odd shooting star. Purely decorative
// (aria-hidden) and fully disabled under prefers-reduced-motion.
export function FuturisticBackground() {
  return (
    <div className="fx" aria-hidden="true">
      <div className="fx-stars fx-stars--far" />
      <div className="fx-stars fx-stars--near" />

      <span className="fx-blob fx-blob--violet" />
      <span className="fx-blob fx-blob--magenta" />
      <span className="fx-blob fx-blob--cyan" />

      {TWINKLE_STARS.map((s, i) => (
        <span
          key={i}
          className="fx-star"
          style={{ left: s.l, top: s.t, width: s.s, height: s.s, animationDelay: s.d }}
        />
      ))}

      <span className="fx-meteor fx-meteor--1" />
      <span className="fx-meteor fx-meteor--2" />

      <div className="fx-grid" />
      <div className="fx-vignette" />
    </div>
  );
}

// All landing-page CSS, kept self-contained so the page has no external style
// dependency beyond the app's @theme tokens. Reveal base + ambient animations +
// the chat/palm/typing motion, every block reduced-motion-safe. Scroll reveals
// are keyed off the [data-reveal] attribute so any section can opt in/out.
export function LandingStyles() {
  return (
    <style>{`
      [data-reveal]{opacity:0;transform:translateY(20px);transition:opacity .6s ease,transform .6s cubic-bezier(.22,1,.36,1)}
      [data-reveal].reveal-in{opacity:1;transform:none}

      .fx { position: fixed; inset: 0; z-index: -10; overflow: hidden; pointer-events: none;
            transform: translateZ(0); contain: strict;
            background:
              radial-gradient(1000px 720px at 100% -6%, rgba(139,92,246,0.30), transparent 55%),
              radial-gradient(820px 620px at 0% 106%, rgba(34,211,238,0.12), transparent 55%),
              linear-gradient(215deg, rgba(139,92,246,0.10) 0%, transparent 48%),
              #05050c; }

      .fx-stars { position: absolute; inset: -50%; background-repeat: repeat;
                  will-change: transform; backface-visibility: hidden;
                  background-image:
                    radial-gradient(1px 1px at 20% 30%, #fff, transparent),
                    radial-gradient(1px 1px at 70% 60%, #cbd5e1, transparent),
                    radial-gradient(1px 1px at 40% 80%, #fff, transparent),
                    radial-gradient(1px 1px at 85% 20%, #a5b4fc, transparent),
                    radial-gradient(1px 1px at 55% 15%, #fff, transparent),
                    radial-gradient(1.5px 1.5px at 30% 50%, #e9d5ff, transparent); }
      .fx-stars--far  { background-size: 700px 700px; opacity: 0.4; animation: fxDrift 340s linear infinite; }
      .fx-stars--near { background-size: 420px 420px; opacity: 0.6; animation: fxDrift 220s linear infinite reverse; }

      .fx-blob { position: absolute; border-radius: 50%; filter: blur(55px); opacity: 0.5; will-change: transform; }
      .fx-blob--violet  { width: 460px; height: 460px; top: -90px; right: -60px;  background: radial-gradient(circle, #8b5cf6, transparent 70%); animation: fxFloat 26s ease-in-out infinite; }
      .fx-blob--magenta { width: 340px; height: 340px; top: 24%; right: -40px;    background: radial-gradient(circle, #d946ef, transparent 70%); opacity: 0.4; animation: fxFloat 32s ease-in-out infinite reverse; }
      .fx-blob--cyan    { width: 340px; height: 340px; bottom: 4%; left: -40px;    background: radial-gradient(circle, #22d3ee, transparent 70%); opacity: 0.35; animation: fxFloat 38s ease-in-out infinite; }

      .fx-star { position: absolute; border-radius: 50%; background: #fff;
                 box-shadow: 0 0 6px 1px rgba(199,210,254,0.85); opacity: 0.85;
                 animation: fxStarTwinkle 4s ease-in-out infinite; will-change: opacity; }

      .fx-meteor { position: absolute; height: 2px; width: 220px; border-radius: 999px;
                   background: linear-gradient(90deg, transparent, rgba(199,210,254,0.55) 55%, #fff);
                   opacity: 0; will-change: transform, opacity; }
      .fx-meteor::after { content: ""; position: absolute; right: -2px; top: 50%; width: 4px; height: 4px;
                          border-radius: 50%; transform: translateY(-50%); background: #fff;
                          box-shadow: 0 0 10px 3px rgba(199,210,254,0.9), 0 0 22px 6px rgba(139,92,246,0.5); }
      .fx-meteor--1 { top: 2vh; left: 0; animation: fxMeteor 16s linear infinite; animation-delay: 3s; }
      .fx-meteor--2 { top: 12vh; left: 0; animation: fxMeteorLeft 16s linear infinite; animation-delay: 11s; }

      .fx-grid { position: absolute; left: 50%; bottom: -10vh; width: 200vw; height: 60vh; transform: translateX(-50%) perspective(420px) rotateX(70deg);
                 background-image:
                   linear-gradient(rgba(139,92,246,0.28) 1px, transparent 1px),
                   linear-gradient(90deg, rgba(139,92,246,0.28) 1px, transparent 1px);
                 background-size: 56px 56px; mask-image: linear-gradient(to top, #000 10%, transparent 80%);
                 -webkit-mask-image: linear-gradient(to top, #000 10%, transparent 80%);
                 opacity: 0.55; }

      .fx-vignette { position: absolute; inset: 0; background: radial-gradient(120% 80% at 50% 0%, transparent 55%, rgba(5,5,12,0.85)); }

      /* Hero/section zodiac wheel: rotates while glyphs counter-rotate (stay upright). */
      .rashi-wheel  { animation: rashiSpin 120s linear infinite; transform-origin: 50% 50%; will-change: transform; }
      .rashi-glyph  { animation: rashiSpinRev 120s linear infinite; transform-box: fill-box; transform-origin: 50% 50%; will-change: transform; }
      .rashi-halo   { animation: rashiPulse 6s ease-in-out infinite; }
      @keyframes rashiSpin    { to { transform: rotate(360deg); } }
      @keyframes rashiSpinRev { to { transform: rotate(-360deg); } }
      @keyframes rashiPulse   { 0%,100% { opacity: 0.75; } 50% { opacity: 1; } }

      /* Neon-glow cards. */
      .fx-card { transition: transform .25s ease, border-color .25s ease, box-shadow .25s ease; }
      .fx-card:hover { transform: translateY(-4px); border-color: rgba(139,92,246,0.5);
                       box-shadow: 0 0 0 1px rgba(139,92,246,0.4), 0 22px 55px rgba(139,92,246,0.20); }

      /* Primary CTA affordance: pointer cursor + lift + brighter glow on hover. */
      .cta-glow { cursor: pointer; will-change: transform;
                  transition: transform .2s cubic-bezier(.22,1,.36,1), box-shadow .25s ease, filter .2s ease; }
      .cta-glow:hover { transform: translateY(-2px) scale(1.03); filter: brightness(1.07);
                        box-shadow: 0 16px 42px rgba(139,92,246,0.55); }
      .cta-glow:active { transform: translateY(0) scale(0.97); transition-duration: .08s; }

      /* Chat bubbles rise + fade in once (used in hero preview + astrologer demo). */
      .chat-rise { opacity: 0; animation: chatRise .5s cubic-bezier(.22,1,.36,1) forwards; }
      @keyframes chatRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

      /* Palm-report meter bars fill from 0 → target width (--bar-w) on mount. */
      .bar-fill { width: 0; animation: barFill 1.4s cubic-bezier(.22,1,.36,1) forwards; }
      @keyframes barFill { to { width: var(--bar-w); } }

      /* Bento chat is a bottom-anchored window (no scrollbar) — the oldest visible
         turn softly fades out at the TOP edge as new ones arrive below it. */
      .mask-fade-t { -webkit-mask-image: linear-gradient(to bottom, transparent, #000 18%); mask-image: linear-gradient(to bottom, transparent, #000 18%); }

      /* Typing indicator dots. */
      .typing-dot { width: 6px; height: 6px; border-radius: 50%; background: #c4b5fd;
                    display: inline-block; animation: typingBlink 1.2s ease-in-out infinite; }
      @keyframes typingBlink { 0%,100% { opacity: .25; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-2px); } }

      /* Scanning line animation. */
      .scan-line { animation: scanMove 4s ease-in-out infinite; }
      @keyframes scanMove {
        0%, 100% { top: 15%; opacity: 0; }
        10%, 90% { opacity: 1; }
        50% { top: 85%; }
      }

      /* Hand outline draws first, then each line traces over it. pathLength="1"
         lets one keyframe drive every stroke regardless of real length. */
      .palm-outline { stroke-dasharray: 1; stroke-dashoffset: 1; animation: palmDraw 2.2s ease forwards; }
      .palm-line { stroke-dasharray: 1; stroke-dashoffset: 1; animation: palmDraw 1.5s ease forwards; }
      @keyframes palmDraw { to { stroke-dashoffset: 0; } }
      .palm-dot { opacity: 0; transform-box: fill-box; transform-origin: center; animation: palmPop .5s ease forwards; }
      @keyframes palmPop { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }

      @keyframes fxDrift  { to { transform: translate(-60px, -40px); } }
      @keyframes fxFloat  { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(28px,-22px) scale(1.08); } }
      @keyframes fxStarTwinkle { 0%,100% { opacity: 0.85; } 50% { opacity: 0.18; } }
      @keyframes fxMeteor {
        0%   { transform: translate(82vw, -12vh) rotate(150deg); opacity: 0; }
        4%   { opacity: 1; }
        15%  { opacity: 1; }
        26%  { transform: translate(-28vw, 78vh) rotate(150deg); opacity: 0; }
        100% { transform: translate(-28vw, 78vh) rotate(150deg); opacity: 0; }
      }
      @keyframes fxMeteorLeft {
        0%   { transform: translate(-15vw, -12vh) rotate(30deg); opacity: 0; }
        4%   { opacity: 1; }
        15%  { opacity: 1; }
        26%  { transform: translate(110vw, 78vh) rotate(30deg); opacity: 0; }
        100% { transform: translate(110vw, 78vh) rotate(30deg); opacity: 0; }
      }

      @media (prefers-reduced-motion: reduce) {
        [data-reveal] { opacity: 1 !important; transform: none !important; transition: none; }
        .fx-stars, .fx-blob, .fx-star, .fx-meteor,
        .rashi-wheel, .rashi-glyph, .rashi-halo,
        .chat-rise, .typing-dot, .scan-line, .palm-outline, .palm-line, .palm-dot, .bar-fill { animation: none !important; }
        .fx-meteor { display: none; }
        .fx-card:hover, .cta-glow:hover, .cta-glow:active { transform: none; }
        .chat-rise { opacity: 1; }
        .bar-fill { width: var(--bar-w); }
        .palm-outline, .palm-line { stroke-dashoffset: 0; }
        .palm-dot { opacity: 1; }
      }
    `}</style>
  );
}
