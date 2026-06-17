// Labelled text field. Bundles the label + input styling that was copy-pasted
// across the admin forms (and mirrors the app's .premium-input look).
//
// Usage:
//   <Field label="Username" value={u} onChange={(e) => setU(e.target.value)} />
//   <Field as="textarea" label="Message" rows={4} value={b} onChange={…} />
//
// `inputStyle` tweaks the control; `style` tweaks the wrapper. All other props
// (value, onChange, placeholder, maxLength, disabled, type…) pass to the input.

import { useState } from "react";
import { LuInfo, LuEye, LuEyeOff } from "react-icons/lu";

export default function Field({ as: Tag = "input", label, style, inputStyle, children, info, ...rest }) {
  // <input> is a void element — passing children errors. Only forward children
  // to container controls (select/textarea), where the <option>s live.
  const tagProps = Tag === "input" ? rest : { ...rest, children };

  // Password fields get a show/hide eye toggle. We swap the input's type locally
  // while leaving the caller's type="password" prop untouched (so autofill /
  // password managers still treat it as a password field).
  const isPassword = Tag === "input" && rest.type === "password";
  const [showPw, setShowPw] = useState(false);

  const control = (
    <Tag
      style={{
        ...inputBase,
        ...(Tag === "textarea" ? { resize: "vertical", fontFamily: "inherit" } : null),
        ...(isPassword ? { paddingRight: 42 } : null),
        ...inputStyle,
      }}
      {...tagProps}
      {...(isPassword ? { type: showPw ? "text" : "password" } : null)}
    />
  );

  return (
    <div style={style}>
      {label && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>{label}</label>
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
      {isPassword ? (
        <div style={{ position: "relative" }}>
          {control}
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            disabled={rest.disabled}
            aria-label={showPw ? "Hide password" : "Show password"}
            title={showPw ? "Hide password" : "Show password"}
            className="text-dim transition-colors hover:text-primary"
            style={eyeBtnStyle}
          >
            {showPw ? <LuEyeOff size={18} /> : <LuEye size={18} />}
          </button>
        </div>
      ) : (
        control
      )}
    </div>
  );
}

const labelStyle = {
  display: "block",
  color: "var(--c-text-body)",
  fontSize: 12,
  marginBottom: 6,
  letterSpacing: 1,
};
const inputBase = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 14px",
  borderRadius: 10,
  background: "var(--c-input-bg)",
  border: "1px solid var(--c-border)",
  color: "var(--c-text)",
  fontSize: 14,
  outline: "none",
};
const eyeBtnStyle = {
  position: "absolute",
  top: "50%",
  right: 8,
  transform: "translateY(-50%)",
  display: "grid",
  placeItems: "center",
  padding: 4,
  background: "transparent",
  border: "none",
  cursor: "pointer",
  lineHeight: 0,
};
