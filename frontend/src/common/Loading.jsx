// Shared loading indicators. `Spinner` is the bare sparkle pulse used app-wide;
// `Loading` centers it in an area with an optional label. Replaces the
// hand-rolled splash in App.jsx (PageLoader), AuthGate, and admin tables.

import { Icon } from "@/utils/icons";

export function Spinner({ size = 32 }) {
  return (
    <div style={{ animation: "pulse-gold 2s infinite ease-in-out", lineHeight: 0 }}>
      <Icon name="SPARKLES" size={size} />
    </div>
  );
}

export default function Loading({ label, minHeight = "60vh", style }) {
  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        gap: 12,
        minHeight,
        color: "var(--c-text-dim)",
        ...style,
      }}
    >
      <Spinner />
      {label && <span style={{ fontSize: 14 }}>{label}</span>}
    </div>
  );
}
