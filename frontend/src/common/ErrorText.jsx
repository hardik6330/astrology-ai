// Inline error message — the red paragraph repeated across forms and pages.
// Renders nothing when empty, so callers can drop the `error && (...)` guard:
//   <ErrorText>{error}</ErrorText>
//
// Styled with Tailwind utilities (text-danger → --color-danger from index.css
// @theme). `className`/`style` still pass through for per-use overrides.

export default function ErrorText({ children, className = "", style }) {
  if (!children) return null;
  return (
    <p className={`mt-2 mb-0 text-[13px] text-danger ${className}`} style={style}>
      {children}
    </p>
  );
}
