// Labelled text field. Bundles the label + input styling that was copy-pasted
// across the admin forms (and mirrors the app's .premium-input look).
//
// Usage:
//   <Field label="Username" value={u} onChange={(e) => setU(e.target.value)} />
//   <Field as="textarea" label="Message" rows={4} value={b} onChange={…} />
//
// `inputStyle` tweaks the control; `style` tweaks the wrapper. All other props
// (value, onChange, placeholder, maxLength, disabled, type…) pass to the input.

export default function Field({ as: Tag = "input", label, style, inputStyle, ...rest }) {
  return (
    <div style={style}>
      {label && <label style={labelStyle}>{label}</label>}
      <Tag
        style={{
          ...inputBase,
          ...(Tag === "textarea" ? { resize: "vertical", fontFamily: "inherit" } : null),
          ...inputStyle,
        }}
        {...rest}
      />
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
