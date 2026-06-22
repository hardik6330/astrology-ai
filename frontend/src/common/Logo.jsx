import { useId } from "react";

// Brand mark — a ringed planet with a small orbiting spark, drawn in the brand
// violet→indigo gradient. Replaces the bare ✦ emoji so the brand reads as a
// designed product (Linear/Stripe-tier) rather than a template. Pairs with the
// "Selora" wordmark, which callers render in the display font.
export default function Logo({ size = 22, className = "" }) {
  const id = useId(); // unique gradient ids so multiple logos on a page don't clash
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-g`} x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a78bfa" />
          <stop offset="0.55" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      {/* planet */}
      <circle cx="12" cy="12" r="6" fill={`url(#${id}-g)`} />
      {/* highlight */}
      <circle cx="9.8" cy="9.8" r="1.7" fill="#fff" opacity="0.55" />
      {/* tilted ring */}
      <ellipse
        cx="12"
        cy="12"
        rx="10"
        ry="3.4"
        transform="rotate(-25 12 12)"
        stroke={`url(#${id}-g)`}
        strokeWidth="1.6"
        opacity="0.9"
      />
      {/* orbiting spark */}
      <circle cx="20.2" cy="6.6" r="1.15" fill="#fbbf24" />
    </svg>
  );
}
