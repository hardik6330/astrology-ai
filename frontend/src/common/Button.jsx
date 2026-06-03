// Shared button. Centralizes the gradient primary look + busy/disabled + icon
// gap that were hand-redefined across the admin pages and login screens.
//
// Usage:
//   <Button onClick={fn}>Save</Button>                         // primary (default)
//   <Button variant="ghost" icon={LuChevronLeft}>Prev</Button>
//   <Button variant="danger" icon={LuLogOut}>Logout</Button>
//   <Button busy={busy} busyLabel="Sending…" icon={LuSend} type="submit">Send</Button>
//   <Button variant="magic" fullWidth>Generate</Button>        // app .magic-btn look
//
// `busy` disables and (with busyLabel) swaps the label. Extra props/refs pass
// through to the underlying <button>.

import { forwardRef } from "react";

const VARIANTS = {
  primary: {
    border: "none",
    background: "var(--grad-primary)",
    color: "var(--c-text)",
  },
  ghost: {
    border: "1px solid rgba(var(--slate-rgb), 0.25)",
    background: "rgba(var(--slate-rgb), 0.08)",
    color: "var(--c-text-body)",
  },
  danger: {
    border: "1px solid rgba(var(--danger-rgb), 0.25)",
    background: "rgba(var(--danger-rgb), 0.08)",
    color: "var(--c-danger)",
  },
};

const base = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "12px 16px",
  borderRadius: 12,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 14,
};

const Button = forwardRef(function Button(
  {
    variant = "primary",
    icon: Icon,
    busy = false,
    busyLabel,
    disabled = false,
    fullWidth = false,
    className,
    style,
    children,
    ...rest
  },
  ref
) {
  const isDisabled = busy || disabled;

  // "magic" defers to the app's .magic-btn CSS class (its own gradient + hover
  // lift). Other variants are styled inline here.
  if (variant === "magic") {
    return (
      <button
        ref={ref}
        className={className ? `magic-btn ${className}` : "magic-btn"}
        style={{ ...(fullWidth && { width: "100%" }), ...style }}
        disabled={isDisabled}
        {...rest}
      >
        {Icon && <Icon size={16} />}
        {busy && busyLabel ? busyLabel : children}
      </button>
    );
  }

  return (
    <button
      ref={ref}
      className={className}
      style={{
        ...base,
        ...VARIANTS[variant],
        ...(fullWidth && { width: "100%" }),
        ...(isDisabled && { opacity: 0.6, cursor: "not-allowed" }),
        ...style,
      }}
      disabled={isDisabled}
      {...rest}
    >
      {Icon && <Icon size={16} />}
      {busy && busyLabel ? busyLabel : children}
    </button>
  );
});

export default Button;
