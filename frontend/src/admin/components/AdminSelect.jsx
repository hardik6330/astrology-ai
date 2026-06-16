// Admin-themed custom dropdown — same UX as the app's birth-form gender select
// (CustomSelect): a clickable box matching the .premium-input look, a rotating
// chevron, and a floating panel with the selected row highlighted by the brand
// gradient. Styled with the admin CSS vars (--c-*, --grad-primary) so it sits
// in the admin theme, and replicates Field's label + info tooltip so it drops
// into AdminSettings beside the text/number fields.
//
// onChange is called the same shape as a native <select> ({ target: { value } })
// so callers don't change.

import { useEffect, useRef, useState } from "react";
import { LuInfo } from "react-icons/lu";

export default function AdminSelect({ label, info, value, onChange, options, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const selected = options.find((o) => o.value === value);

  const choose = (val) => {
    onChange({ target: { value: val } });
    setOpen(false);
  };

  return (
    <div>
      {label && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <label style={labelStyle}>{label}</label>
          {info && (
            <div className="group relative">
              <LuInfo size={14} className="cursor-help text-muted transition-colors hover:text-primary" />
              <div className="invisible absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-lg border border-border bg-card p-3 text-[12px] leading-relaxed text-ink opacity-0 shadow-xl backdrop-blur-md transition-all group-hover:visible group-hover:opacity-100">
                {info}
                <div className="absolute top-full left-1/2 -mt-1 h-2 w-2 -translate-x-1/2 rotate-45 border-r border-b border-border bg-card"></div>
              </div>
            </div>
          )}
        </div>
      )}

      <div ref={ref} style={{ position: "relative" }}>
        <div
          onClick={() => !disabled && setOpen((v) => !v)}
          style={{
            ...boxStyle,
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.6 : 1,
            borderColor: open ? "var(--c-primary)" : "var(--c-border)",
          }}
        >
          <span style={{ color: selected ? "var(--c-text)" : "var(--c-text-muted)" }}>
            {selected ? selected.label : "— select —"}
          </span>
          <span
            style={{
              color: "var(--c-text-dim)",
              fontSize: 12,
              transition: "transform 0.3s ease",
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
            }}
          >
            ▼
          </span>
        </div>

        {open && (
          <div style={panelStyle}>
            {options.map((o) => {
              const isSel = o.value === value;
              return (
                <div
                  key={o.value}
                  onClick={() => choose(o.value)}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    cursor: "pointer",
                    background: isSel ? "var(--grad-primary)" : "transparent",
                    color: isSel ? "#fff" : "var(--c-text)",
                    fontSize: 14,
                    fontWeight: isSel ? 600 : 400,
                    transition: "background 0.2s ease",
                    marginBottom: 2,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSel) e.currentTarget.style.background = "rgba(139, 92, 246, 0.12)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSel) e.currentTarget.style.background = "transparent";
                  }}
                >
                  {o.label}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle = {
  display: "block",
  color: "var(--c-text-body)",
  fontSize: 12,
  marginBottom: 0,
  letterSpacing: 1,
};
const boxStyle = {
  width: "100%",
  boxSizing: "border-box",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 14px",
  borderRadius: 10,
  background: "var(--c-input-bg)",
  border: "1px solid var(--c-border)",
  fontSize: 14,
};
const panelStyle = {
  position: "absolute",
  top: "100%",
  left: 0,
  right: 0,
  marginTop: 8,
  background: "var(--c-card, rgba(15, 14, 32, 0.98))",
  border: "1px solid var(--c-border)",
  borderRadius: 12,
  padding: 8,
  boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
  zIndex: 1000,
  backdropFilter: "blur(12px)",
};
