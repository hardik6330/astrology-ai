// Dummy phone-OTP login. UI mirrors the real flow we'll wire up later —
// for now, "Send OTP" just advances to the OTP step (no SMS) and the
// OTP field is pre-filled with 123456. Any 6-digit code is accepted.

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useChart } from "../context/ChartContext";

const DEFAULT_OTP = "123456";
const RESEND_SECS = 30;

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, token } = useAuth();
  const { applySavedForm } = useChart();
  const [phone, setPhone] = useState("");
  const [otp,   setOtp]   = useState("");
  const [step,  setStep]  = useState("phone");
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const phoneRef = useRef("");

  useEffect(() => {
    if (token) navigate("/", { replace: true });
  }, [token, navigate]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  async function sendOtp(e) {
    e?.preventDefault();
    setError("");
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 10) return setError("Enter a valid 10-digit phone number");

    setBusy(true);
    // Simulate the SMS round-trip so the UX feels real.
    await new Promise((r) => setTimeout(r, 700));
    // Store just the 10-digit number — UI no longer shows a +91 chip.
    phoneRef.current = cleaned.slice(-10);
    setOtp(DEFAULT_OTP);
    setStep("otp");
    setResendIn(RESEND_SECS);
    setBusy(false);
  }

  async function verifyOtp(e) {
    e?.preventDefault();
    setError("");
    if (otp.length !== 6) return setError("Enter the 6-digit code");

    setBusy(true);
    await new Promise((r) => setTimeout(r, 500));
    const { savedForm } = await login({ phone: phoneRef.current });
    // Returning user → hydrate context + land on Reading directly.
    if (savedForm) {
      applySavedForm(savedForm);
      navigate("/reading", { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  }

  return (
    <div style={pageWrap}>
      <CosmicBackdrop />
      <div style={card}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🪐</div>
          <h1 style={{ margin: 0, fontSize: 24, color: "#fff", fontWeight: 700 }}>Sign in to Astrology AI</h1>
          <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: 13 }}>
            {step === "phone"
              ? "We'll send you a one-time code over SMS."
              : `Code sent to ${phoneRef.current}. Enter it below.`}
          </p>
        </div>

        {step === "phone" && (
          <form onSubmit={sendOtp}>
            <label style={label}>Phone number</label>
            <input
              type="tel" inputMode="numeric" autoComplete="tel"
              placeholder="10-digit mobile number"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              style={{ ...input, width: "100%" }}
              disabled={busy}
              maxLength={10}
            />
            <button type="submit" disabled={busy} style={primaryBtn}>
              {busy ? "Sending…" : "Send OTP"}
            </button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={verifyOtp}>
            <label style={label}>6-digit code</label>
            <input
              type="text" inputMode="numeric" autoComplete="one-time-code"
              maxLength={6}
              placeholder="••••••"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              style={{ ...input, letterSpacing: 6, fontSize: 18, textAlign: "center" }}
              disabled={busy}
            />
            <button type="submit" disabled={busy} style={primaryBtn}>
              {busy ? "Verifying…" : "Verify & continue"}
            </button>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontSize: 12 }}>
              <button type="button" onClick={() => { setStep("phone"); setOtp(""); }} style={linkBtn}>
                ← Change number
              </button>
              <button
                type="button"
                onClick={sendOtp}
                disabled={resendIn > 0 || busy}
                style={{ ...linkBtn, opacity: resendIn > 0 ? 0.5 : 1 }}
              >
                {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend OTP"}
              </button>
            </div>
          </form>
        )}

        {error && <p style={{ color: "#f87171", fontSize: 12.5, marginTop: 14 }}>{error}</p>}
      </div>
    </div>
  );
}

// Orbital cosmic backdrop: three faint orbital rings rotate at different
// speeds, each carrying a small "planet" dot. Tiny crisp stars dot the
// space behind them, and a slow nebula glow drifts through the corners.
function CosmicBackdrop() {
  const stars = Array.from({ length: 60 }, (_, i) => ({
    left:  ((i * 53) % 100) + "%",
    top:   ((i * 37) % 100) + "%",
    size:  ((i * 7) % 3) + 1,
    o:     0.3 + ((i * 11) % 7) / 14,
    dur:   2 + (i % 5),
  }));

  return (
    <div style={backdrop}>
      {/* Pulsing nebula glows */}
      <div style={{ ...orb, top: "-20%",  left: "-10%",
        background: "radial-gradient(circle, rgba(139,92,246,0.45), transparent 60%)",
        animation: "orbDrift1 18s ease-in-out infinite" }} />
      <div style={{ ...orb, bottom: "-20%", right: "-10%",
        background: "radial-gradient(circle, rgba(99,102,241,0.35), transparent 60%)",
        animation: "orbDrift2 22s ease-in-out infinite" }} />
      <div style={{ ...orb, top: "40%", right: "30%", width: 300, height: 300,
        background: "radial-gradient(circle, rgba(236,72,153,0.18), transparent 60%)",
        animation: "orbDrift3 26s ease-in-out infinite" }} />

      {/* Crisp circular stars (no SVG stretch) */}
      {stars.map((s, i) => (
        <div key={i} style={{
          position: "absolute", left: s.left, top: s.top,
          width: s.size, height: s.size, borderRadius: "50%",
          background: "#fff", opacity: s.o,
          boxShadow: `0 0 ${s.size * 2}px rgba(255,255,255,0.6)`,
          animation: `twinkle ${s.dur}s ease-in-out infinite`,
          animationDelay: `${(i * 0.13) % 3}s`,
        }} />
      ))}

      {/* Three concentric orbital rings, each spinning at a different speed */}
      <div style={{ ...orbitWrap }}>
        <div style={{ ...orbit, width: 480, height: 480, animation: "spin 80s linear infinite" }}>
          <div style={{ ...planet, background: "#fbbf24", boxShadow: "0 0 12px #fbbf24" }} />
        </div>
        <div style={{ ...orbit, width: 320, height: 320, animation: "spin 50s linear infinite reverse" }}>
          <div style={{ ...planet, background: "#a78bfa", boxShadow: "0 0 12px #a78bfa" }} />
        </div>
        <div style={{ ...orbit, width: 200, height: 200, animation: "spin 30s linear infinite" }}>
          <div style={{ ...planet, background: "#34d399", boxShadow: "0 0 10px #34d399",
                        width: 6, height: 6 }} />
        </div>
        {/* Central sun */}
        <div style={{
          position: "absolute", left: "50%", top: "50%",
          width: 14, height: 14, marginLeft: -7, marginTop: -7,
          borderRadius: "50%", background: "#fff",
          boxShadow: "0 0 28px #c7d2fe, 0 0 60px rgba(167,139,250,0.6)",
          animation: "sunPulse 4s ease-in-out infinite",
        }} />
      </div>

      {/* Shooting star */}
      <div style={shootingStar} />

      <style>{`
        @keyframes twinkle { 0%,100% { opacity: var(--o,1); } 50% { opacity: 0.15; } }
        @keyframes orbDrift1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(40px,30px) scale(1.15); } }
        @keyframes orbDrift2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-50px,-30px) scale(1.1); } }
        @keyframes orbDrift3 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px,-40px) scale(1.2); } }
        @keyframes spin     { from { transform: translate(-50%,-50%) rotate(0); } to { transform: translate(-50%,-50%) rotate(360deg); } }
        @keyframes sunPulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.3); opacity: 0.85; } }
        @keyframes shoot {
          0%   { transform: translate(-200px,-100px) rotate(20deg); opacity: 0; }
          5%   { opacity: 1; }
          25%  { transform: translate(60vw,40vh)     rotate(20deg); opacity: 0; }
          100% { transform: translate(60vw,40vh)     rotate(20deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

const pageWrap = {
  minHeight: "100vh", display: "grid", placeItems: "center",
  background: "radial-gradient(circle at 20% 30%, #1e1b4b 0%, #050508 70%)",
  padding: 16, position: "relative", overflow: "hidden",
};
const backdrop = {
  position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden",
};
const orb = {
  position: "absolute", width: 420, height: 420, borderRadius: "50%",
  filter: "blur(40px)",
};
const glyph = {
  position: "absolute", color: "rgba(167,139,250,0.10)", fontWeight: 300,
  lineHeight: 1, userSelect: "none",
};
const orbitWrap = {
  position: "absolute", inset: 0,
  display: "grid", placeItems: "center", pointerEvents: "none",
};
const orbit = {
  position: "absolute", top: "50%", left: "50%",
  borderRadius: "50%",
  border: "1px dashed rgba(167,139,250,0.18)",
};
const planet = {
  position: "absolute", top: -4, left: "50%", marginLeft: -4,
  width: 8, height: 8, borderRadius: "50%",
};
const shootingStar = {
  position: "absolute", top: 0, left: 0,
  width: 100, height: 2, borderRadius: 2,
  background: "linear-gradient(90deg, transparent, #fff, transparent)",
  boxShadow: "0 0 8px #fff, 0 0 14px rgba(167,139,250,0.6)",
  animation: "shoot 7s ease-in infinite",
};
const card = {
  position: "relative", zIndex: 1,
  width: "100%", maxWidth: 380, background: "rgba(15,15,24,0.78)",
  border: "1px solid rgba(148,163,184,0.2)", borderRadius: 20,
  padding: 28, backdropFilter: "blur(8px)",
  boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
};
const label   = { display: "block", color: "#cbd5e1", fontSize: 12, marginBottom: 6, letterSpacing: 1 };
const input   = { flex: 1, padding: "12px 14px", borderRadius: 10,
                  background: "rgba(148,163,184,0.06)", border: "1px solid rgba(148,163,184,0.2)",
                  color: "#fff", fontSize: 14, outline: "none" };
const primaryBtn = { width: "100%", marginTop: 16, padding: "13px 16px", borderRadius: 12,
                     border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14,
                     background: "linear-gradient(135deg, #8b5cf6, #6366f1)", color: "#fff" };
const linkBtn = { background: "none", border: "none", color: "#a78bfa",
                  cursor: "pointer", fontSize: 12, padding: 0 };
