import { useEffect, useState } from "react";
import { signOf, ZE } from "@/shared/astrology";
import { planetInfoFor } from "./planetInfo";

// Slide-over detail for a tapped planet — web twin of the mobile
// PlanetDetailSheet. Meaning is static (planetInfo.js); the placement line is
// pulled live from the chart so it's specific to this user without inventing.
// Closes on backdrop click or Esc. CSS-transitions in for a modern feel.
export default function PlanetDetailModal({ planet, onClose }) {
  const info = planetInfoFor(planet);
  const [shown, setShown] = useState(false);

  // Mount → next tick flip `shown` so the enter transition runs; Esc closes.
  useEffect(() => {
    if (!planet) return;
    const id = requestAnimationFrame(() => setShown(true));
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("keydown", onKey);
      setShown(false);
    };
  }, [planet, onClose]);

  if (!planet || !info) return null;

  return (
    <div
      onClick={onClose}
      className={`fixed inset-0 z-50 flex items-end justify-center transition-opacity duration-300 sm:items-center ${
        shown ? "opacity-100" : "opacity-0"
      }`}
      style={{ background: "rgba(0,0,0,0.6)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-t-[22px] border border-[rgba(168,85,247,0.3)] bg-[#0f0f18] p-6 shadow-[0_-8px_40px_rgba(0,0,0,0.5)] transition-all duration-300 sm:rounded-[22px] ${
          shown ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
        }`}
      >
        <div className="mb-4 flex items-center gap-3.5">
          <span className="text-[40px] leading-none">{info.glyph}</span>
          <div>
            <p className="m-0 text-lg font-extrabold text-ink">
              {planet.base || planet.name} · {info.vedic}
            </p>
            <p className="m-0 mt-0.5 text-[13px] font-semibold text-[#c084fc]">{info.epithet}</p>
          </div>
        </div>

        {/* Live placement for THIS chart. */}
        <div className="mb-[18px] rounded-[10px] border border-[rgba(168,85,247,0.3)] bg-[rgba(168,85,247,0.08)] px-3.5 py-2.5 text-center text-sm font-bold text-[#c4b5fd]">
          {ZE[signOf(planet.sid)]} {signOf(planet.sid)}
          {planet.houseSid ? ` · House ${planet.houseSid}` : ""}
          {planet.retro ? " · Retrograde ℞" : ""}
        </div>

        <p className="m-0 mb-1.5 text-[11px] font-extrabold tracking-[1.5px] text-muted">WHAT IT GOVERNS</p>
        <p className="m-0 mb-[18px] text-sm leading-[1.6] text-body">{info.represents}</p>

        <div className="mb-5 flex gap-2.5">
          <div className="flex-1 rounded-xl border border-[rgba(34,197,94,0.25)] bg-[rgba(34,197,94,0.06)] p-3">
            <p className="m-0 mb-1.5 text-xs font-extrabold text-success">✓ When strong</p>
            <p className="m-0 text-[12.5px] leading-[1.5] text-body">{info.strong}</p>
          </div>
          <div className="flex-1 rounded-xl border border-[rgba(251,191,36,0.25)] bg-[rgba(251,191,36,0.06)] p-3">
            <p className="m-0 mb-1.5 text-xs font-extrabold text-warning">⚠ When challenged</p>
            <p className="m-0 text-[12.5px] leading-[1.5] text-body">{info.weak}</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full cursor-pointer rounded-xl border border-[rgba(168,85,247,0.4)] bg-[rgba(168,85,247,0.12)] py-3 text-sm font-bold text-[#c084fc] transition-colors hover:bg-[rgba(168,85,247,0.2)]"
        >
          Close
        </button>
      </div>
    </div>
  );
}
