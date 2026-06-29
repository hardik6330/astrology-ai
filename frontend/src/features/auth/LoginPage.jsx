// Real Firebase Phone Auth login. "Send OTP" fires an actual SMS via
// signInWithPhoneNumber (invisible reCAPTCHA), and "Verify" confirms the code
// to get a Firebase ID token, which AuthContext trades for our session JWT.

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ErrorText from "@/common/ErrorText";
import { useAuth } from "@/features/auth/AuthContext";
import { useChart } from "@/context/ChartContext";
import { sendOtp as fbSendOtp, confirmOtp, clearRecaptcha } from "./webOtp";
import { defaultDialCode } from "@/utils/dialCode";
import CountrySelect from "./CountrySelect";
import Logo from "@/common/Logo";
import { Icon } from "@/utils/icons";
// Reuse the landing page's cosmic backdrop so auth and marketing share one
// "hero" background (in-app pages keep the calmer .cosmos backdrop instead).
import { FuturisticBackground, LandingStyles } from "@/pages/landing/backdrop";

const RESEND_SECS = 30;
// Remember the last country code the user picked so returning visitors see it
// pre-selected instead of the browser-region guess.
const DIAL_CODE_KEY = "astro_dial_code";

// Dev OTP bypass. When VITE_OTP_ENABLED='false', skip Firebase SMS and log in
// straight from the typed phone number. Mirrors the backend OTP_ENABLED flag —
// the backend still rejects the bypass unless its own flag is 'false' too.
const OTP_ENABLED = import.meta.env.VITE_OTP_ENABLED !== "false";

export default function LoginPage() {
  const navigate = useNavigate();
  const { completeOtpLogin, completePhoneBypass, token } = useAuth();
  const { applySavedForm } = useChart();
  const [phone, setPhone] = useState("");
  // Country dialing code (digits, no "+"). Prefer the user's last saved choice;
  // otherwise fall back to the browser region (no permission/GPS). Editable, so a
  // user whose browser locale differs from their number's country can correct it.
  const [dialCode, setDialCode] = useState(() => {
    try {
      const saved = localStorage.getItem(DIAL_CODE_KEY);
      if (saved && /^\d{1,4}$/.test(saved)) return saved;
    } catch {
      /* localStorage unavailable (private mode) — fall through */
    }
    return defaultDialCode();
  });

  // Persist the selected country code for next time.
  useEffect(() => {
    try {
      localStorage.setItem(DIAL_CODE_KEY, dialCode);
    } catch {
      /* ignore */
    }
  }, [dialCode]);
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("phone");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(0);
  // Holds the Firebase confirmationResult between "send" and "verify".
  const confirmationRef = useRef(null);

  useEffect(() => {
    if (token) navigate("/", { replace: true });
  }, [token, navigate]);

  // Route the user after a successful login (either path).
  function routeAfterLogin(savedForm) {
    if (savedForm) {
      applySavedForm(savedForm);
      navigate("/reading", { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  }

  // Drop the reCAPTCHA widget when leaving the screen.
  useEffect(() => () => clearRecaptcha(), []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  async function sendOtp(e) {
    e?.preventDefault();
    setError("");
    // Full E.164 number = country code (auto-detected, editable) + national digits.
    const code = dialCode.replace(/\D/g, "");
    const national = phone.replace(/\D/g, "");
    const full = `${code}${national}`;
    if (!code) return setError("Enter your country code");
    if (national.length < 6 || full.length > 15) return setError("Enter a valid phone number");
    const cleaned = full;

    setBusy(true);
    try {
      // Dev bypass: no SMS — trade the bare phone for a session and route in.
      if (!OTP_ENABLED) {
        const { savedForm } = await completePhoneBypass(`+${cleaned}`);
        routeAfterLogin(savedForm);
        return;
      }
      // Send the SMS, then go to the code screen. Firebase needs full E.164
      // format (+ country code + national number).
      confirmationRef.current = await fbSendOtp(`+${cleaned}`);
      setStep("otp");
      setResendIn(RESEND_SECS);
    } catch (err) {
      setError(otpError(err));
    } finally {
      setBusy(false);
    }
  }

  // Resend the SMS: clear the old code so the user types the new one fresh, and
  // show a loading state on the button so the tap is obviously registered.
  async function resendOtp() {
    if (resendIn > 0 || busy || resending) return;
    setOtp("");
    setResending(true);
    try {
      await sendOtp();
    } finally {
      setResending(false);
    }
  }

  async function verifyOtp(e) {
    e?.preventDefault();
    setError("");
    if (otp.length !== 6) return setError("Enter the 6-digit code");
    if (!confirmationRef.current) return setError("Please request a code first");

    setBusy(true);
    try {
      const idToken = await confirmOtp(confirmationRef.current, otp);
      const { savedForm } = await completeOtpLogin(idToken);
      routeAfterLogin(savedForm);
    } catch (err) {
      setError(otpError(err));
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-y-auto overflow-x-hidden p-4 py-8">
      <FuturisticBackground />
      <LandingStyles />
      <div className="relative z-1 grid w-full max-w-5xl grid-cols-1 rounded-[24px] border border-(--c-border) bg-[rgba(var(--panel-rgb),0.78)] shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-[8px] md:grid-cols-2">
        {/* ── Left: brand / value panel (desktop only) — reassures the visitor
            at the exact moment we ask for their phone number. ── */}
        <aside
          className="relative hidden flex-col justify-between overflow-hidden rounded-l-[24px] p-9 md:flex"
          style={{
            background:
              "linear-gradient(160deg, rgba(139,92,246,0.20), rgba(99,102,241,0.06) 55%, transparent)",
            borderRight: "1px solid var(--c-border)",
          }}
        >
          <div>
            <Link
              to="/"
              aria-label="Selora — go to home"
              className="font-display flex w-fit items-center gap-2 text-lg font-extrabold text-ink no-underline transition-opacity hover:opacity-80"
            >
              <Logo size={30} /> Selora
            </Link>
            <h2 className="mt-8 text-3xl font-extrabold leading-tight text-ink">
              Your stars are
              <br />
              waiting for you.
            </h2>
            <p className="mt-3 max-w-xs text-sm text-body">
              Sign in to unlock a reading made just for you — accurate, personal, and private.
            </p>

            <ul className="mt-7 space-y-3.5">
              {[
                ["SPARKLES", "A personal Vedic birth chart & reading"],
                ["HAND_OPEN", "AI palm reading — your photo is never stored"],
                ["CHAT", "An AI astrologer that knows your chart"],
                ["CALENDAR", "Daily guidance & predictions"],
              ].map(([icon, text]) => (
                <li key={text} className="flex items-center gap-3 text-sm text-body">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-(--c-border) bg-white/5 text-[#c4b5fd]">
                    <Icon name={icon} size={16} />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <Icon name="STAR" size={12} /> First reading free
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon name="LOCK" size={12} /> One code — no spam, ever
            </span>
          </div>
        </aside>

        {/* ── Right: login form ── */}
        <div className="p-7 md:p-9">
          <div className="mb-7 text-center">
            <div className="mb-3 flex justify-center">
              <Logo size={48} className="rounded-xl" />
            </div>
            <h1 className="m-0 text-2xl font-bold text-ink">Sign in to Selora</h1>
            <p className="mt-2 mb-0 text-[13px] text-dim">
              {step === "phone"
                ? "We'll text you one code — no spam, ever."
                : `Code sent to +${dialCode} ${phone}. Enter it below.`}
            </p>
          </div>

          {step === "phone" && (
            <form onSubmit={sendOtp}>
              <label className={labelCls}>Phone number</label>
              <div className={`${inputCls} flex items-center gap-1 px-0 py-0`}>
                <CountrySelect value={dialCode} onChange={setDialCode} disabled={busy} />
                <span className="my-2 w-px self-stretch bg-(--c-border)" />
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="mobile number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 12))}
                  className="flex-1 min-w-0 bg-transparent py-3 px-3.5 text-sm text-ink outline-none"
                  disabled={busy}
                  maxLength={12}
                />
              </div>
              <button type="submit" disabled={busy} className={primaryBtnCls}>
                {busy ? "Sending…" : "Send OTP"}
              </button>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={verifyOtp}>
              <label className={labelCls}>6-digit code</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="••••••"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className={`${inputCls} text-center text-lg tracking-[6px]`}
                disabled={busy}
              />
              <button type="submit" disabled={busy} className={primaryBtnCls}>
                {busy ? "Verifying…" : "Verify & continue"}
              </button>
              <div className="mt-3.5 flex justify-between text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStep("phone");
                    setOtp("");
                  }}
                  className={`${linkBtnCls} inline-flex items-center gap-1`}
                >
                  <Icon name="LEFT_ARROW" size={12} /> Change number
                </button>
                <button
                  type="button"
                  onClick={resendOtp}
                  disabled={resendIn > 0 || busy || resending}
                  className={`${linkBtnCls} ${resendIn > 0 || resending ? "opacity-50" : "opacity-100"}`}
                >
                  {resending ? "Sending…" : resendIn > 0 ? `Resend in ${resendIn}s` : "Resend OTP"}
                </button>
              </div>
            </form>
          )}

          <ErrorText style={{ fontSize: 12.5, margin: "14px 0 0" }}>{error}</ErrorText>
          {/* Invisible reCAPTCHA mount point — required by signInWithPhoneNumber. */}
          <div id="recaptcha-container" />
          {/* Required attribution — lets us hide the floating reCAPTCHA badge
            (.grecaptcha-badge) per Google's terms. */}
          <p className="mt-3.5 mb-0 text-center text-[10.5px] leading-snug text-dim">
            This site is protected by reCAPTCHA and the Google{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noreferrer"
              className="text-[#a78bfa] underline"
            >
              Privacy Policy
            </a>{" "}
            and{" "}
            <a
              href="https://policies.google.com/terms"
              target="_blank"
              rel="noreferrer"
              className="text-[#a78bfa] underline"
            >
              Terms of Service
            </a>{" "}
            apply.
          </p>
        </div>
      </div>
    </div>
  );
}

// Map Firebase Auth error codes to friendly messages.
function otpError(err) {
  const code = err?.code || "";
  if (code.includes("invalid-verification-code")) return "Incorrect code. Please try again.";
  if (code.includes("code-expired")) return "Code expired. Tap Resend to get a new one.";
  if (code.includes("invalid-phone-number")) return "That phone number looks invalid.";
  if (code.includes("too-many-requests")) return "Too many attempts. Please wait and try again.";
  if (code.includes("quota-exceeded")) return "SMS limit reached. Please try again later.";
  return err?.message || "Something went wrong. Please try again.";
}

// Shared Tailwind class strings for the form controls.
const labelCls = "mb-1.5 block text-xs tracking-[1px] text-subtle";
const inputCls =
  "w-full rounded-[10px] border border-(--c-border) bg-(--c-input-bg) px-3.5 py-3 text-ink outline-none";
const primaryBtnCls =
  "mt-4 w-full cursor-pointer rounded-xl border-none bg-(image:--grad-primary) px-4 py-[13px] text-sm font-bold text-ink";
const linkBtnCls = "cursor-pointer border-none bg-transparent p-0 text-xs text-[#a78bfa]";
