// Public marketing landing — the FIRST thing an unauthenticated visitor sees.
// Explains what the product does, then funnels to login/signup. Rendered at "/"
// by RootEntry only when there's no session; authed users get HomePage instead.
//
// Design intent: every major section tells a DIFFERENT visual story (bento grid,
// palm analysis card, kundli wheel, a live AI-chat demo, a day timeline, an FAQ
// accordion) so the page never reads as "the same card, eight times". All copy
// in the honest sections is true of the product (no fabricated reviews/stats).
//
// This file is just the page composition; the data, backdrop/CSS, and the
// individual visuals live in ./landing/* so each piece stays editable on its
// own. The QR phone mock is lazy-loaded (it's the only `qrcode.react` consumer,
// far down the page) so that lib stays out of the eager landing bundle.
import { useEffect, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import {
  LuSparkles,
  LuShieldCheck,
  LuInfinity,
  LuListChecks,
  LuZap,
  LuArrowRight,
  LuLock,
  LuSmartphone,
} from "react-icons/lu";
import { FaApple, FaGooglePlay } from "react-icons/fa";
import Logo from "@/common/Logo";

import { BENTO, STEPS, DAY_PARTS, FAQS, APP_PERKS, APP_STORE_URL, PLAY_STORE_URL } from "./landing/data";
import { FuturisticBackground, LandingStyles } from "./landing/backdrop";
import { PalmReportPreview, RashiWheel } from "./landing/visuals";
import { ChatPreview, AstrologerDemo, BentoChatThread } from "./landing/chat";
import FaqItem from "./landing/FaqItem";

// Lazy so `qrcode.react` is split into its own chunk, loaded only when a visitor
// scrolls to the app section — not in the first paint everyone downloads.
const PhoneMock = lazy(() => import("./landing/PhoneMock"));

export default function LandingPage() {
  const navigate = useNavigate();
  const goLogin = () => navigate("/login");

  // Scroll-choreographed reveals: each [data-reveal] section fades/slides up as
  // it enters the viewport (Linear/Stripe-style), instead of all content sitting
  // static under constant ambient motion. Disabled under reduced-motion. The
  // observer is keyed off the [data-reveal] attribute, so a section opts in by
  // adding it (and the hero/trust-strip deliberately don't).
  useEffect(() => {
    const els = document.querySelectorAll("[data-reveal]");
    if (!els.length) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      els.forEach((el) => el.classList.add("reveal-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("reveal-in");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#05050c] text-ink">
      {/* ── Futuristic astro backdrop (fixed, behind everything) ── */}
      <FuturisticBackground />
      <LandingStyles />

      {/* Top glow that starts at the very top of the page (behind the header),
          so the header sits on the cosmic purple instead of a black band. Same
          tones as the hero glow below, just lifted up to cover the header. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-200"
        style={{
          background:
            "radial-gradient(1000px 620px at 70% -4%, rgba(139,92,246,0.28), transparent 62%), radial-gradient(760px 520px at 12% 0%, rgba(99,102,241,0.18), transparent 60%)",
        }}
      />

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-transparent">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <span className="flex items-center gap-0 text-lg font-extrabold">
            <Logo size={50} />
            <span className="font-display">Selora</span>
          </span>
          <nav className="flex items-center gap-3">
            <a href="#features" className="hidden text-sm font-semibold text-body hover:text-ink sm:inline">
              Features
            </a>
            <a href="#faq" className="hidden text-sm font-semibold text-body hover:text-ink sm:inline">
              FAQ
            </a>
            <button
              onClick={goLogin}
              className="cta-glow rounded-full px-5 py-2 text-sm font-bold text-ink"
              style={{ background: "var(--grad-primary)" }}
            >
              Get Started
            </button>
          </nav>
        </div>
      </header>

      {/* ── Hero — headline + live AI-chat preview (not a card grid) ─ */}
      {/* No section-local glow here: the page-level top glow above spans the
          header + hero as ONE gradient, so there's no seam/line at the header. */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-2 md:py-24">
          <div>
            <span className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-[var(--c-border)] bg-white/5 px-3 py-1 text-xs font-semibold tracking-wide text-subtle">
              <LuSparkles size={13} className="text-[#c084fc]" /> AI Astrology · Vedic · Privacy-first
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
              Free AI chatbots <span className="text-ink">guess</span> your chart. Selora gives you an{" "}
              <span className="text-ink">accurate</span> one — a personal Kundli reading, daily predictions,
              an AI astrologer that truly knows your chart, and an{" "}
              <span className="text-ink">AI palm reading they can't do</span>. Private, and ready in seconds.
            </p>
            {/* One dominant CTA — secondary action demoted to a quiet text link. */}
            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
              <button
                onClick={goLogin}
                className="cta-glow group inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-base font-bold text-ink shadow-[0_10px_30px_rgba(139,92,246,0.35)]"
                style={{ background: "var(--grad-primary)" }}
              >
                Get Your Free Reading{" "}
                <LuArrowRight className="transition-transform duration-200 group-hover:translate-x-1" />
              </button>
              <a
                href="#features"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-body hover:text-ink"
              >
                See how it works ↓
              </a>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
              <li className="inline-flex items-center gap-1.5">
                <LuSparkles size={13} className="text-[#c084fc]" /> First reading free — no card needed
              </li>
              <li className="inline-flex items-center gap-1.5">
                <LuShieldCheck size={13} className="text-success" /> Your palm photo is never stored
              </li>
            </ul>
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-dim">
              <LuLock size={12} /> Sign in with your phone — we text one code, that's it. No spam, ever.
            </p>
          </div>

          {/* Right: a compact, animated AI-astrologer chat preview. */}
          <div className="flex justify-center">
            <ChatPreview />
          </div>
        </div>
      </section>

      {/* ── Trust strip — TRUE facts only, horizontal, no card ──── */}
      <section className="border-y border-[var(--c-border)] bg-white/[0.03]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-5 py-5 text-sm">
          {[
            [LuSparkles, "First reading free"],
            [LuShieldCheck, "Palm photo never stored"],
            [LuInfinity, "No subscription"],
            [LuListChecks, "Shows its reasoning"],
            [LuZap, "Ready in seconds"],
          ].map(([Icon, label], i) => (
            <span key={label} className="inline-flex items-center gap-2 font-semibold text-subtle">
              <Icon size={15} className="text-[#c084fc]" /> {label}
              {i < 4 && <span className="ml-6 hidden h-4 w-px bg-white/10 sm:inline-block" />}
            </span>
          ))}
        </div>
      </section>

      {/* ── Features — asymmetric BENTO grid (varied tile sizes) ── */}
      <section id="features" data-reveal className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-warning">What we do</p>
          <h2 className="text-3xl font-extrabold md:text-4xl">One chart. Endless guidance.</h2>
          <p className="mt-3 text-body">Everything the platform does, grounded in your real Vedic chart.</p>
        </div>

        <div className="mt-12 grid auto-rows-[1fr] gap-4 sm:grid-cols-3">
          {BENTO.map((f) => (
            <article
              key={f.title}
              className={`fx-card group relative overflow-hidden rounded-3xl border border-[var(--c-border)] bg-white/[0.04] p-7 ${
                f.span || ""
              }`}
            >
              {f.big && (
                <div
                  className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-60 blur-2xl"
                  style={{ background: "radial-gradient(circle, rgba(139,92,246,0.5), transparent 70%)" }}
                  aria-hidden="true"
                />
              )}
              <div
                className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{ background: "var(--grad-primary)", boxShadow: "0 0 22px rgba(139,92,246,0.55)" }}
              >
                <f.icon className="text-xl text-ink" />
              </div>
              <h3 className={f.big ? "text-2xl font-bold" : "text-lg font-bold"}>{f.title}</h3>
              <p className={`mt-2 text-body ${f.big ? "text-base" : "text-sm"}`}>{f.desc}</p>

              {/* The large tile plays a live, looping AI-astrologer conversation. */}
              {f.big && <BentoChatThread />}
            </article>
          ))}
        </div>
      </section>

      {/* ── Palm reading — analysis card, not a generic feature card ─ */}
      <section data-reveal className="mx-auto max-w-6xl px-5 pb-16 md:pb-24">
        <div className="grid items-center gap-12 md:grid-cols-2 md:gap-20">
          <div className="order-2 md:order-1">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-warning">
              AI palm reading
            </p>
            <h2 className="text-3xl font-extrabold md:text-5xl md:leading-tight">
              We read the lines, and show the math.
            </h2>
            <p className="mt-5 max-w-md text-base leading-relaxed text-body md:text-lg">
              Snap one photo. We detect 21 points on your hand and measure the real geometry of your major
              lines — then explain what it means. The chips you see are <em>measured</em>, never invented.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                ["Heart line", "relationships & emotional style"],
                ["Head line", "how you think & decide"],
                ["Life line", "vitality & life rhythm"],
                ["Fate line", "career direction & timing"],
              ].map(([k, v]) => (
                <li key={k} className="flex items-center gap-3 text-sm">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#c084fc] shadow-[0_0_10px_rgba(192,132,252,0.8)]" />
                  <span className="font-semibold text-ink">{k}</span>
                  <span className="text-muted">— {v}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[var(--c-border)] bg-white/[0.03] px-3.5 py-1.5 text-xs font-semibold text-subtle">
              <LuShieldCheck size={14} className="text-success" /> Your photo is discarded after the reading
            </div>
          </div>
          <div className="order-1 flex justify-center md:order-2">
            <PalmReportPreview />
          </div>
        </div>
      </section>

      {/* ── Kundli — the rotating zodiac bi-wheel as the centerpiece ─ */}
      <section data-reveal className="mx-auto max-w-6xl px-5 pb-16 md:pb-24">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div className="flex justify-center">
            <RashiWheel />
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-warning">Birth chart</p>
            <h2 className="text-3xl font-extrabold md:text-4xl">Your sky, the moment you were born.</h2>
            <p className="mt-3 max-w-md text-body">
              A complete Vedic Kundli computed from real astronomical positions for your exact date, time, and
              place — twelve houses, every graha, your dashas and live transits. Not a template; your chart.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {[
                ["12", "houses mapped"],
                ["9", "grahas placed"],
                ["Dasha", "timeline of periods"],
                ["Gochar", "live sky overlay"],
              ].map(([v, l]) => (
                <div
                  key={l}
                  className="rounded-2xl border border-[var(--c-border)] bg-white/[0.03] px-4 py-3"
                >
                  <div className="text-lg font-extrabold text-primary">{v}</div>
                  <div className="text-xs text-muted">{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── AI astrologer — a real product chat window with typing ─ */}
      <section data-reveal className="mx-auto max-w-5xl px-5 pb-16 md:pb-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-warning">AI astrologer</p>
          <h2 className="text-3xl font-extrabold md:text-4xl">Ask anything. Get answers from your chart.</h2>
          <p className="mt-3 text-body">
            Not a generic chatbot — it reads your real placements and shows the evidence behind each answer.
          </p>
        </div>
        <div className="mx-auto mt-10 max-w-xl">
          <AstrologerDemo />
        </div>
      </section>

      {/* ── Daily guidance — a day TIMELINE, not cards ──────────── */}
      <section data-reveal className="mx-auto max-w-4xl px-5 pb-16 md:pb-24">
        <div className="text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-warning">
            Daily guidance
          </p>
          <h2 className="text-3xl font-extrabold md:text-4xl">Mapped to the real sky, hour by hour.</h2>
          <p className="mt-3 text-body">A glimpse of the format — your actual guidance is personal to you.</p>
        </div>
        <ol className="relative mx-auto mt-12 max-w-2xl">
          {/* vertical spine */}
          <span
            className="absolute left-[19px] top-2 bottom-2 w-px bg-gradient-to-b from-[#8b5cf6] via-[#d946ef]/40 to-transparent"
            aria-hidden="true"
          />
          {DAY_PARTS.map((p) => (
            <li key={p.k} className="relative flex gap-5 pb-8 last:pb-0">
              <span
                className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--c-border)]"
                style={{ background: "var(--grad-primary)", boxShadow: "0 0 18px rgba(139,92,246,0.5)" }}
              >
                <p.i className="text-base text-ink" />
              </span>
              <div className="pt-1.5">
                <h3 className="text-sm font-bold text-ink">{p.k}</h3>
                <p className="mt-1 text-sm text-body">{p.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ── How it works — a connected 3-step stepper ───────────── */}
      <section data-reveal className="mx-auto max-w-5xl px-5 pb-16 md:pb-24">
        <div className="text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-warning">How it works</p>
          <h2 className="text-3xl font-extrabold md:text-4xl">Three steps to your reading.</h2>
        </div>
        <ol className="relative mt-12 grid gap-8 md:grid-cols-3">
          {/* connecting line across the steps on desktop */}
          <span
            className="absolute left-[12%] right-[12%] top-6 hidden h-px bg-gradient-to-r from-transparent via-[#8b5cf6]/50 to-transparent md:block"
            aria-hidden="true"
          />
          {STEPS.map((s) => (
            <li key={s.n} className="relative text-center">
              <div
                className="mx-auto flex h-12 w-12 items-center justify-center rounded-full text-base font-extrabold text-ink"
                style={{ background: "var(--grad-primary)", boxShadow: "0 0 20px rgba(139,92,246,0.5)" }}
              >
                {s.n}
              </div>
              <h3 className="mt-4 text-base font-bold">{s.t}</h3>
              <p className="mt-1.5 text-sm text-body">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Pricing — honest, one statement row + chips ─────────── */}
      <section data-reveal className="mx-auto max-w-4xl px-5 pb-16 md:pb-24">
        <div
          className="overflow-hidden rounded-3xl border border-[var(--c-border)] p-8 text-center md:p-12"
          style={{
            background:
              "radial-gradient(600px 300px at 50% -30%, rgba(139,92,246,0.22), transparent 60%), rgba(255,255,255,0.03)",
          }}
        >
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-warning">
            Simple &amp; fair
          </p>
          <h2 className="text-3xl font-extrabold md:text-4xl">Start free. Pay only for what you use.</h2>
          <p className="mx-auto mt-3 max-w-xl text-body">
            No subscription, no surprise charges. Your first reading is on us — after that, simple
            pay-as-you-go credits you top up only when you want more.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
            {[
              [LuSparkles, "First reading free"],
              [LuLock, "Secure UPI & card payments"],
              [LuInfinity, "Credits never expire"],
              [LuShieldCheck, "No subscription"],
            ].map(([Icon, label]) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--c-border)] bg-white/[0.04] px-3.5 py-1.5 text-xs font-semibold text-subtle"
              >
                <Icon size={13} className="text-[#c084fc]" /> {label}
              </span>
            ))}
          </div>
          <button
            onClick={goLogin}
            className="cta-glow group mt-8 inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-base font-bold text-ink"
            style={{ background: "var(--grad-primary)" }}
          >
            See Mine — Free{" "}
            <LuArrowRight className="transition-transform duration-200 group-hover:translate-x-1" />
          </button>
          <p className="mt-4 text-xs text-dim">
            Exact credit prices are always shown in your account before you spend.
          </p>
        </div>
      </section>

      {/* ── Privacy — split statement + checklist ───────────────── */}
      <section data-reveal className="mx-auto max-w-6xl px-5 pb-16 md:pb-24">
        <div className="grid gap-8 md:grid-cols-[1fr_1.4fr] md:items-center">
          <div>
            <div className="flex items-center gap-3">
              <LuShieldCheck className="text-2xl text-success" />
              <h2 className="text-2xl font-extrabold md:text-3xl">Your data stays yours.</h2>
            </div>
            <p className="mt-3 max-w-md text-body">
              We built privacy into the architecture, not the marketing. Nothing here is a promise we couldn't
              keep.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                i: LuShieldCheck,
                t: "Palm photo never saved",
                d: "Used only to create your reading, then gone for good.",
              },
              {
                i: LuSmartphone,
                t: "Details stay private",
                d: "Never shared, sold, or used to train anything.",
              },
              {
                i: LuLock,
                t: "You stay anonymous",
                d: "Your readings are personal; your identity is protected.",
              },
              {
                i: LuListChecks,
                t: "Honest by design",
                d: "Every prediction shows the reasoning behind it.",
              },
            ].map((p) => (
              <div key={p.t} className="rounded-2xl border border-[var(--c-border)] bg-white/[0.03] p-5">
                <p.i className="text-lg text-primary" />
                <strong className="mt-2 block text-sm text-ink">{p.t}</strong>
                <p className="mt-1 text-xs text-body">{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Mobile app — phone mock + scannable QR ──────────────── */}
      <section data-reveal className="mx-auto max-w-6xl px-5 pb-16 md:pb-24">
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

          <div className="flex justify-center">
            <Suspense fallback={<div className="h-[472px] w-[232px]" />}>
              <PhoneMock />
            </Suspense>
          </div>
        </div>
      </section>

      {/* ── FAQ — minimal accordion ─────────────────────────────── */}
      <section id="faq" data-reveal className="mx-auto max-w-3xl px-5 pb-16 md:pb-24">
        <div className="text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-warning">Questions</p>
          <h2 className="text-3xl font-extrabold md:text-4xl">Good to know.</h2>
        </div>
        <div className="mt-10 divide-y divide-[var(--c-border)] border-y border-[var(--c-border)]">
          {FAQS.map((f, i) => (
            <FaqItem key={f.q} q={f.q} a={f.a} defaultOpen={i === 0} />
          ))}
        </div>
      </section>

      {/* ── Final CTA — full-width cosmic block ─────────────────── */}
      <section data-reveal className="mx-auto max-w-4xl px-5 pb-20">
        <div
          className="relative overflow-hidden rounded-3xl border border-[var(--c-border)] p-10 text-center md:p-14"
          style={{
            background: "radial-gradient(700px 360px at 50% -20%, rgba(139,92,246,0.3), transparent 60%)",
          }}
        >
          <p className="text-sm font-semibold tracking-wide text-[#c084fc]">Your chart is already written.</p>
          <h2 className="mx-auto mt-2 max-w-xl text-3xl font-extrabold md:text-4xl">
            Let Selora decode it with you.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-body">
            Create a free account and get your first reading in under a minute. No card needed.
          </p>
          <button
            onClick={goLogin}
            className="cta-glow group mt-7 inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-base font-bold text-ink"
            style={{ background: "var(--grad-primary)" }}
          >
            Get Your Free AI Reading{" "}
            <LuArrowRight className="transition-transform duration-200 group-hover:translate-x-1" />
          </button>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--c-border)] py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 text-sm text-muted sm:flex-row">
          <span className="flex items-center gap-2 font-bold text-body">
            <Logo size={26} /> <span className="font-display">Selora</span>
          </span>
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {/* static pages — full browser nav, not the SPA router */}
            <a href="/birth-chart-ai/" className="hover:text-ink">
              AI Birth Chart
            </a>
            <a href="/palm-reading-ai/" className="hover:text-ink">
              AI Palm Reading
            </a>
            <a href="/ai-astrologer-chat/" className="hover:text-ink">
              AI Astrologer Chat
            </a>
            <a href="/compare/best-ai-astrology-apps/" className="hover:text-ink">
              Compare to other AI
            </a>
            <a href="/privacy/" className="hover:text-ink">
              Privacy
            </a>
            <a href="/terms/" className="hover:text-ink">
              Terms
            </a>
            <a href="/about/" className="hover:text-ink">
              About
            </a>
          </nav>
          <span>Made just for you. © 2026 Selora.</span>
        </div>
      </footer>
    </div>
  );
}
