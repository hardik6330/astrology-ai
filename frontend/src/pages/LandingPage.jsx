// Public marketing landing — the FIRST thing an unauthenticated visitor sees.
// Explains what the product does, then funnels to login/signup. Rendered at "/"
// by RootEntry only when there's no session; authed users get HomePage instead.
// Styling follows the app palette (index.css @theme tokens) — no new dependency.
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  LuSparkles,
  LuHand,
  LuMessageCircle,
  LuCalendarDays,
  LuShieldCheck,
  LuSmartphone,
  LuArrowRight,
  LuBell,
  LuZap,
  LuScan,
} from "react-icons/lu";
import { FaApple, FaGooglePlay } from "react-icons/fa";

// App download targets. Point QR + badges at the live store listings once they
// exist; until then they go to the site, which can device-detect and redirect.
const APP_LINK = "https://astro-ai.mooo.com/app";
const APP_STORE_URL = "https://astro-ai.mooo.com/app"; // TODO: App Store listing
const PLAY_STORE_URL = "https://astro-ai.mooo.com/app"; // TODO: Play Store listing

const APP_PERKS = [
  { i: LuScan, t: "Scan your palm with the camera" },
  { i: LuBell, t: "Daily guidance, delivered to you" },
  { i: LuZap, t: "Fast, and works offline anywhere" },
  { i: LuShieldCheck, t: "Private, secure sign-in" },
];

// Crisp foreground twinkle stars (deterministic positions — same approach as the
// login CosmicBackdrop). Rendered as glowing DOM dots over the drifting starfield.
const TWINKLE_STARS = Array.from({ length: 18 }, (_, i) => ({
  l: `${(i * 61) % 100}%`,
  t: `${(i * 37) % 97}%`,
  s: `${(i % 3) + 1}px`,
  d: `${((i * 0.37) % 4).toFixed(2)}s`,
}));

// 12 zodiac glyphs, Aries → Pisces — the same set the mobile app's splash wheel
// uses (mobile/src/components/SplashScreen.js), rendered in the same warm cream.
// Each carries U+FE0E (text-presentation selector) so browsers draw the
// monochrome LINE glyph (which respects `fill`) instead of a color-emoji box.
const VS_TEXT = String.fromCharCode(0xfe0e); // U+FE0E text-presentation selector
const RASHI = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"].map(
  (g) => g + VS_TEXT
);

const FEATURES = [
  {
    icon: LuSparkles,
    title: "Birth Chart AI (Kundli)",
    desc: "A complete Vedic birth chart with a clear, personal reading — your life theme, career, relationships, strengths, and remedies, with the reasoning shown behind every insight so you can trust it.",
  },
  {
    icon: LuHand,
    title: "AI Palm Reading",
    desc: "Snap a photo of your hand for a structured palmistry reading. We show the measured geometry of your lines — never invented numbers — and your photo is never stored.",
  },
  {
    icon: LuMessageCircle,
    title: "AI Astrologer Chat",
    desc: "Ask about career, love, money, or timing. The AI is grounded in your real chart, remembers your prior questions, and even folds in your palm reading.",
  },
  {
    icon: LuCalendarDays,
    title: "Daily Predictions",
    desc: "Guidance mapped to the real sky for any day — Moon transit, alignment score, lucky colour & number, auspicious windows, and Rahu Kaal.",
  },
];

const STEPS = [
  {
    n: "01",
    t: "Share your birth details",
    d: "Just your date, time, and place of birth — that's all it takes to get started.",
  },
  {
    n: "02",
    t: "Get your personalized reading",
    d: "Your complete birth chart and a clear, personal reading — accurate and ready in seconds.",
  },
  {
    n: "03",
    t: "Explore and ask anything",
    d: "Dive into daily guidance, scan your palm, and chat with your personal AI astrologer anytime.",
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const goLogin = () => navigate("/login");

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#05050c] text-ink">
      {/* ── Futuristic astro backdrop (fixed, behind everything) ── */}
      <FuturisticBackground />

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-transparent">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <span className="flex items-center gap-2 text-lg font-extrabold">
            <span className="text-warning">✦</span> Astro AI
          </span>
          <nav className="flex items-center gap-3">
            <button
              onClick={goLogin}
              className="rounded-full px-5 py-2 text-sm font-bold text-ink"
              style={{ background: "var(--grad-primary)" }}
            >
              Get Started
            </button>
          </nav>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(900px 480px at 70% -10%, rgba(139,92,246,0.25), transparent 60%), radial-gradient(700px 400px at 10% 10%, rgba(99,102,241,0.16), transparent 55%)",
          }}
          aria-hidden="true"
        />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-2 md:py-24">
          <div>
            <span className="mb-5 inline-block rounded-full border border-[var(--c-border)] bg-white/5 px-3 py-1 text-xs font-semibold tracking-wide text-subtle">
              ✦ AI Astrology · Vedic · Privacy-first
            </span>
            <h1 className="text-4xl font-extrabold leading-tight md:text-5xl">
              The AI astrologer that{" "}
              <span
                style={{
                  background: "linear-gradient(135deg,#8b5cf6,#d946ef,#22d3ee)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                shows its work.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-body md:text-lg">
              Accurate, deeply personal guidance — made just for you. Get an instant Kundli reading, an AI
              palm reading, daily predictions, and an AI astrologer that truly knows your chart. Private,
              honest, and ready in seconds.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button
                onClick={goLogin}
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-base font-bold text-ink"
                style={{ background: "var(--grad-primary)" }}
              >
                Get Your Free AI Reading <LuArrowRight />
              </button>
              <a
                href="#features"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--c-border)] bg-white/5 px-6 py-3 text-base font-semibold text-body hover:text-ink"
              >
                See what it does
              </a>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
              <li>★ No card needed</li>
              <li>✦ Your palm photo is never stored</li>
              <li>◈ Private — your data stays yours</li>
            </ul>
          </div>

          {/* Bi-wheel motif */}
          <div className="flex justify-center" aria-hidden="true">
            <svg
              viewBox="0 0 360 360"
              className="rashi-wheel w-[min(400px,82%)]"
              style={{ filter: "drop-shadow(0 0 30px rgba(139,92,246,0.35))" }}
            >
              <defs>
                <radialGradient id="halo" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(139,92,246,0.5)" />
                  <stop offset="100%" stopColor="rgba(139,92,246,0)" />
                </radialGradient>
                {/* same amber → lavender → pink ring gradient as the mobile splash wheel */}
                <linearGradient
                  id="wheelGrad"
                  x1="180"
                  y1="30"
                  x2="180"
                  y2="330"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0%" stopColor="#fde68a" />
                  <stop offset="40%" stopColor="#c4b5fd" />
                  <stop offset="100%" stopColor="#f9a8d4" />
                </linearGradient>
              </defs>

              {/* glow + concentric rings (gradient strokes, matching mobile) */}
              <circle className="rashi-halo" cx="180" cy="180" r="150" fill="url(#halo)" />
              <circle
                cx="180"
                cy="180"
                r="150"
                fill="none"
                stroke="url(#wheelGrad)"
                strokeWidth="1.6"
                opacity="0.95"
              />
              <circle
                cx="180"
                cy="180"
                r="108"
                fill="none"
                stroke="url(#wheelGrad)"
                strokeWidth="1.2"
                opacity="0.8"
              />
              <circle
                cx="180"
                cy="180"
                r="60"
                fill="none"
                stroke="url(#wheelGrad)"
                strokeWidth="1"
                opacity="0.5"
              />

              {/* 12 house spokes dividing the sign band */}
              {Array.from({ length: 12 }).map((_, i) => {
                const a = ((i * 30 - 90) * Math.PI) / 180;
                return (
                  <line
                    key={`spoke-${i}`}
                    x1={180 + 60 * Math.cos(a)}
                    y1={180 + 60 * Math.sin(a)}
                    x2={180 + 150 * Math.cos(a)}
                    y2={180 + 150 * Math.sin(a)}
                    stroke="url(#wheelGrad)"
                    strokeWidth="0.8"
                    opacity="0.55"
                  />
                );
              })}

              {/* the 12 rashi glyphs — warm cream (#fef3c7), upright, like the mobile app */}
              {RASHI.map((s, i) => {
                const a = ((i * 30 - 90 + 15) * Math.PI) / 180;
                const r = 129;
                return (
                  <text
                    key={`rashi-${i}`}
                    className="rashi-glyph"
                    x={180 + r * Math.cos(a)}
                    y={180 + r * Math.sin(a)}
                    fontSize="21"
                    fontWeight="600"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#fef3c7"
                    style={{ filter: "drop-shadow(0 0 5px rgba(254,243,199,0.45))" }}
                  >
                    {s}
                  </text>
                );
              })}

              {/* center spark */}
              <text
                x="180"
                y="180"
                fontSize="26"
                textAnchor="middle"
                dominantBaseline="central"
                fill="#fde68a"
              >
                ✦
              </text>
            </svg>
          </div>
        </div>
      </section>

      {/* ── Differentiator strip ───────────────────────────────── */}
      <section className="border-y border-[var(--c-border)] bg-white/[0.03]">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-6 px-5 py-6 text-center">
          {[
            { v: "Instant", l: "Readings in under a minute" },
            { v: "Personal", l: "Tailored to your birth chart" },
            { v: "Private", l: "Your photos are never stored" },
            { v: "Daily", l: "Fresh guidance every day" },
          ].map((s) => (
            <div key={s.l} className="min-w-[130px]">
              <div className="text-xl font-extrabold text-primary">{s.v}</div>
              <div className="text-xs text-muted">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────── */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-warning">What we do</p>
          <h2 className="text-3xl font-extrabold md:text-4xl">One chart. Endless guidance.</h2>
          <p className="mt-3 text-body">Everything the platform does, grounded in your real Vedic chart.</p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <article
              key={f.title}
              className="fx-card rounded-3xl border border-[var(--c-border)] bg-white/[0.04] p-7"
            >
              <div
                className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{ background: "var(--grad-primary)", boxShadow: "0 0 22px rgba(139,92,246,0.55)" }}
              >
                <f.icon className="text-xl text-ink" />
              </div>
              <h3 className="text-lg font-bold">{f.title}</h3>
              <p className="mt-2 text-sm text-body">{f.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────── */}
      <section className="mx-auto max-w-4xl px-5 pb-16 md:pb-24">
        <div className="text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-warning">How it works</p>
          <h2 className="text-3xl font-extrabold md:text-4xl">Three steps to your reading.</h2>
        </div>
        <ol className="mt-12 grid gap-5 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="rounded-3xl border border-[var(--c-border)] bg-white/[0.03] p-6">
              <div className="text-2xl font-extrabold text-primary">{s.n}</div>
              <h3 className="mt-2 text-base font-bold">{s.t}</h3>
              <p className="mt-1 text-sm text-body">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Trust / privacy ────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pb-16 md:pb-24">
        <div className="rounded-3xl border border-[var(--c-border)] bg-white/[0.04] p-8 md:p-10">
          <div className="flex items-center gap-3">
            <LuShieldCheck className="text-2xl text-success" />
            <h2 className="text-2xl font-extrabold md:text-3xl">Your data stays yours.</h2>
          </div>
          <p className="mt-2 max-w-2xl text-body">
            We built privacy into the architecture, not the marketing.
          </p>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {[
              {
                i: LuShieldCheck,
                t: "Your palm photo is never saved.",
                d: "Your image is used only to create your reading — then it's gone for good.",
              },
              {
                i: LuSmartphone,
                t: "Your details stay private.",
                d: "Your personal information is never shared, sold, or used to train anything.",
              },
              {
                i: LuSparkles,
                t: "You stay anonymous.",
                d: "Your readings are personal to you, while your identity stays protected.",
              },
              {
                i: LuMessageCircle,
                t: "Honest by design.",
                d: "Every prediction shows the reasoning behind it, so you always know why.",
              },
            ].map((p) => (
              <div key={p.t} className="flex items-start gap-3">
                <p.i className="mt-1 shrink-0 text-lg text-primary" />
                <div>
                  <strong className="text-ink">{p.t}</strong>
                  <p className="text-sm text-body">{p.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Mobile app ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pb-16 md:pb-24">
        <div className="grid gap-10 overflow-hidden rounded-3xl border border-[var(--c-border)] bg-white/[0.04] p-8 md:grid-cols-2 md:items-center md:p-12">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-warning">Mobile app</p>
            <h2 className="text-3xl font-extrabold md:text-4xl">Best experienced on mobile.</h2>
            <p className="mt-3 max-w-md text-body">
              Carry your chart in your pocket. Scan your palm with the camera, get daily guidance delivered to
              you, follow your live transits, and chat with your AI astrologer — anytime, even offline.
            </p>

            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {APP_PERKS.map((p) => (
                <li key={p.t} className="flex items-center gap-2.5 text-sm text-body">
                  <p.i className="shrink-0 text-primary" /> {p.t}
                </li>
              ))}
            </ul>

            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-2xl border border-white/15 bg-black px-5 py-2.5 transition hover:border-white/35"
              >
                <FaApple className="text-2xl text-ink" />
                <span className="leading-tight">
                  <span className="block text-[10px] text-dim">Download on the</span>
                  <span className="block text-base font-semibold text-ink">App Store</span>
                </span>
              </a>
              <a
                href={PLAY_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-2xl border border-white/15 bg-black px-5 py-2.5 transition hover:border-white/35"
              >
                <FaGooglePlay className="text-xl text-ink" />
                <span className="leading-tight">
                  <span className="block text-[10px] text-dim">GET IT ON</span>
                  <span className="block text-base font-semibold text-ink">Google Play</span>
                </span>
              </a>
            </div>
          </div>

          {/* Phone mockup with a scannable QR on screen */}
          <div className="flex justify-center">
            <PhoneMock />
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-4xl px-5 pb-20">
        <div
          className="relative overflow-hidden rounded-3xl border border-[var(--c-border)] p-10 text-center"
          style={{
            background: "radial-gradient(700px 360px at 50% -20%, rgba(139,92,246,0.3), transparent 60%)",
          }}
        >
          <h2 className="mx-auto max-w-xl text-3xl font-extrabold md:text-4xl">
            Meet the AI astrologer that shows its work.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-body">
            Create a free account and get your first reading in under a minute. No card needed.
          </p>
          <button
            onClick={goLogin}
            className="mt-7 inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-base font-bold text-ink"
            style={{ background: "var(--grad-primary)" }}
          >
            Get Your Free AI Reading <LuArrowRight />
          </button>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--c-border)] py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 text-sm text-muted sm:flex-row">
          <span className="flex items-center gap-2 font-bold text-body">
            <span className="text-warning">✦</span> Astro AI
          </span>
          <span>Personal astrology, made just for you. © 2026 Astrology AI Pro.</span>
        </div>
      </footer>
    </div>
  );
}

// Phone mockup with a real, scannable QR on screen (rendered inline as SVG, so
// no external request — CSP-safe). The QR encodes APP_LINK.
function PhoneMock() {
  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="absolute -inset-8 -z-10 rounded-[3rem] blur-2xl"
        style={{ background: "radial-gradient(circle, rgba(139,92,246,0.45), transparent 70%)" }}
      />
      <div
        className="relative w-[232px] rounded-[2.6rem] border border-white/15 bg-[#0b0b16] p-3"
        style={{ boxShadow: "0 30px 80px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.05)" }}
      >
        {/* notch */}
        <div className="absolute left-1/2 top-3 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-black/80" />
        {/* screen */}
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-b from-[#12121f] to-[#0a0a14] px-5 pb-7 pt-11 text-center">
          <div className="flex items-center justify-center gap-1.5 text-sm font-extrabold">
            <span className="text-warning">✦</span> Astro AI
          </div>
          <p className="mt-1 text-[11px] text-dim">Scan to download</p>
          <div
            className="mx-auto mt-4 w-fit rounded-2xl bg-white p-3"
            style={{ boxShadow: "0 0 30px rgba(139,92,246,0.35)" }}
          >
            <QRCodeSVG value={APP_LINK} size={140} bgColor="#ffffff" fgColor="#0b0b16" level="M" />
          </div>
          <p className="mt-4 text-[11px] leading-snug text-subtle">
            Point your camera at the code to get the app on iOS or Android.
          </p>
          <div className="mt-4 flex items-center justify-center gap-3 text-lg text-dim">
            <FaApple />
            <FaGooglePlay className="text-base" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Fixed, GPU-cheap cosmic backdrop: twinkling starfield, drifting nebula blobs,
// a neon perspective-grid horizon, and the odd shooting star. Purely decorative
// (aria-hidden) and fully disabled under prefers-reduced-motion.
function FuturisticBackground() {
  return (
    <div className="fx" aria-hidden="true">
      {/* star layers */}
      <div className="fx-stars fx-stars--far" />
      <div className="fx-stars fx-stars--near" />

      {/* nebula blobs */}
      <span className="fx-blob fx-blob--violet" />
      <span className="fx-blob fx-blob--magenta" />
      <span className="fx-blob fx-blob--cyan" />

      {/* crisp glowing twinkle stars (foreground sparkle, like the login backdrop) */}
      {TWINKLE_STARS.map((s, i) => (
        <span
          key={i}
          className="fx-star"
          style={{ left: s.l, top: s.t, width: s.s, height: s.s, animationDelay: s.d }}
        />
      ))}

      {/* falling stars / meteors — from BOTH sides: --1/--3 enter from the right
          (TR→BL), --2/--4 enter from the left (TL→BR) */}
      <span className="fx-meteor fx-meteor--1" />
      <span className="fx-meteor fx-meteor--2" />
      <span className="fx-meteor fx-meteor--3" />
      <span className="fx-meteor fx-meteor--4" />

      {/* neon perspective grid horizon */}
      <div className="fx-grid" />
      <div className="fx-vignette" />

      <style>{`
        /* Directional lighting: primary source TOP-RIGHT, falling off toward the
           BOTTOM-LEFT (violet key light + cyan bounce + a diagonal sheen). */
        /* translateZ(0) isolates the whole backdrop onto its own GPU layer so
           scrolling the page above it never triggers a repaint of it. */
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
        .fx-stars--far  { background-size: 700px 700px; opacity: 0.5; animation: fxDrift 200s linear infinite; }
        .fx-stars--near { background-size: 420px 420px; opacity: 0.8; animation: fxDrift 120s linear infinite reverse, fxTwinkle 6s ease-in-out infinite; }

        /* will-change promotes each blob to its own layer: the expensive blur is
           rasterised ONCE, then the layer just translates (cheap). */
        .fx-blob { position: absolute; border-radius: 50%; filter: blur(55px); opacity: 0.5; will-change: transform; }
        .fx-blob--violet  { width: 460px; height: 460px; top: -90px; right: -60px;  background: radial-gradient(circle, #8b5cf6, transparent 70%); animation: fxFloat 26s ease-in-out infinite; }
        .fx-blob--magenta { width: 340px; height: 340px; top: 24%; right: -40px;    background: radial-gradient(circle, #d946ef, transparent 70%); opacity: 0.4; animation: fxFloat 32s ease-in-out infinite reverse; }
        .fx-blob--cyan    { width: 340px; height: 340px; bottom: 4%; left: -40px;    background: radial-gradient(circle, #22d3ee, transparent 70%); opacity: 0.35; animation: fxFloat 38s ease-in-out infinite; }

        /* Crisp glowing stars that twinkle (ported from the login backdrop). */
        .fx-star { position: absolute; border-radius: 50%; background: #fff;
                   box-shadow: 0 0 6px 1px rgba(199,210,254,0.85); opacity: 0.85;
                   animation: fxStarTwinkle 4s ease-in-out infinite; will-change: opacity; }

        /* Falling stars / meteors: a tapered trail with a bright glowing head,
           sweeping top-right → bottom-left (matching the key light). Each is
           visible only briefly, then idles, so they streak periodically rather
           than constantly — staggered + on different lanes for variety. */
        .fx-meteor { position: absolute; height: 2px; width: 220px; border-radius: 999px;
                     background: linear-gradient(90deg, transparent, rgba(199,210,254,0.55) 55%, #fff);
                     opacity: 0; will-change: transform, opacity; }
        .fx-meteor::after { content: ""; position: absolute; right: -2px; top: 50%; width: 4px; height: 4px;
                            border-radius: 50%; transform: translateY(-50%); background: #fff;
                            box-shadow: 0 0 10px 3px rgba(199,210,254,0.9), 0 0 22px 6px rgba(139,92,246,0.5); }
        .fx-meteor--1 { top: 0;    left: 0; animation: fxMeteor  7s   linear infinite; animation-delay: 1s; }   /* from right */
        .fx-meteor--2 { top: 4vh;  left: 0; animation: fxMeteorB 9s   linear infinite; animation-delay: 3.5s; } /* from left  */
        .fx-meteor--3 { top: 22vh; left: 0; animation: fxMeteor  8.5s linear infinite; animation-delay: 6s; }   /* from right */
        .fx-meteor--4 { top: 26vh; left: 0; animation: fxMeteorB 10s  linear infinite; animation-delay: 8.5s; } /* from left  */

        .fx-grid { position: absolute; left: 50%; bottom: -10vh; width: 200vw; height: 60vh; transform: translateX(-50%) perspective(420px) rotateX(70deg);
                   background-image:
                     linear-gradient(rgba(139,92,246,0.28) 1px, transparent 1px),
                     linear-gradient(90deg, rgba(139,92,246,0.28) 1px, transparent 1px);
                   background-size: 56px 56px; mask-image: linear-gradient(to top, #000 10%, transparent 80%);
                   -webkit-mask-image: linear-gradient(to top, #000 10%, transparent 80%);
                   opacity: 0.55; }

        .fx-vignette { position: absolute; inset: 0; background: radial-gradient(120% 80% at 50% 0%, transparent 55%, rgba(5,5,12,0.85)); }

        /* Hero zodiac wheel: the whole wheel rotates, but each glyph counter-
           rotates at the SAME speed about its own centre, so the signs orbit
           while staying upright (never upside-down). Halo gently pulses. */
        .rashi-wheel  { animation: rashiSpin 90s linear infinite; transform-origin: 50% 50%; will-change: transform; }
        .rashi-glyph  { animation: rashiSpinRev 90s linear infinite; transform-box: fill-box; transform-origin: 50% 50%; will-change: transform; }
        .rashi-halo   { animation: rashiPulse 6s ease-in-out infinite; }
        @keyframes rashiSpin    { to { transform: rotate(360deg); } }
        @keyframes rashiSpinRev { to { transform: rotate(-360deg); } }
        @keyframes rashiPulse   { 0%,100% { opacity: 0.75; } 50% { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .rashi-wheel, .rashi-glyph, .rashi-halo { animation: none; }
        }

        /* Neon-glow feature cards (defined here so the landing stays self-contained). */
        .fx-card { transition: transform .25s ease, border-color .25s ease, box-shadow .25s ease; }
        .fx-card:hover { transform: translateY(-4px); border-color: rgba(139,92,246,0.5);
                         box-shadow: 0 0 0 1px rgba(139,92,246,0.4), 0 22px 55px rgba(139,92,246,0.20); }
        @media (prefers-reduced-motion: reduce) { .fx-card:hover { transform: none; } }

        @keyframes fxDrift  { to { transform: translate(-60px, -40px); } }
        @keyframes fxFloat  { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(28px,-22px) scale(1.08); } }
        @keyframes fxTwinkle{ 0%,100% { opacity: 0.85; } 50% { opacity: 0.5; } }
        @keyframes fxStarTwinkle { 0%,100% { opacity: 0.85; } 50% { opacity: 0.18; } }
        /* enters top-RIGHT, falls to bottom-left (head leads down-left) */
        @keyframes fxMeteor {
          0%   { transform: translate(82vw, -12vh) rotate(150deg); opacity: 0; }
          4%   { opacity: 1; }
          15%  { opacity: 1; }
          26%  { transform: translate(-28vw, 78vh) rotate(150deg); opacity: 0; }
          100% { transform: translate(-28vw, 78vh) rotate(150deg); opacity: 0; }
        }
        /* mirror: enters top-LEFT, falls to bottom-right (head leads down-right) */
        @keyframes fxMeteorB {
          0%   { transform: translate(-30vw, -12vh) rotate(30deg); opacity: 0; }
          4%   { opacity: 1; }
          15%  { opacity: 1; }
          26%  { transform: translate(84vw, 78vh) rotate(30deg); opacity: 0; }
          100% { transform: translate(84vw, 78vh) rotate(30deg); opacity: 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .fx-stars, .fx-blob, .fx-star, .fx-meteor { animation: none !important; }
          .fx-meteor { display: none; }
        }
      `}</style>
    </div>
  );
}
