// Two-mode design tokens. `color` stays exported as the dark palette so any
// legacy import keeps compiling — but components should pull their palette
// from `useTheme().colors` to react to runtime mode changes.

const dark = {
  // Brand (kept identical across modes — purple is part of our identity)
  primary:        "#a855f7",
  primaryLight:   "#c084fc",
  primarySoft:    "rgba(168, 85, 247, 0.15)",
  primaryBorder:  "rgba(168, 85, 247, 0.4)",

  accent:         "#6366f1",
  accentLight:    "#a5b4fc",
  accentSoft:     "rgba(99, 102, 241, 0.10)",
  accentBorder:   "rgba(99, 102, 241, 0.4)",

  // Status
  success:        "#22c55e",
  warning:        "#fbbf24",
  danger:         "#f87171",
  dangerStrong:   "#ef4444",
  info:           "#60a5fa",

  // Text
  text:           "#ffffff",
  textBody:       "#cbd5e1",
  textDim:        "#94a3b8",
  textMuted:      "#64748b",
  textFaint:      "#475569",

  // Surfaces
  bg:             "#050508",
  cardBg:         "rgba(20, 20, 30, 0.6)",
  cardBgSolid:    "#0f0f18",
  cardBorder:     "rgba(255, 255, 255, 0.10)",
  inputBg:        "rgba(255, 255, 255, 0.05)",

  gradFrom:       "#6366f1",
  gradTo:         "#a855f7",
};

const light = {
  primary:        "#7c3aed",
  primaryLight:   "#a855f7",
  primarySoft:    "rgba(124, 58, 237, 0.10)",
  primaryBorder:  "rgba(124, 58, 237, 0.35)",

  accent:         "#4f46e5",
  accentLight:    "#6366f1",
  accentSoft:     "rgba(79, 70, 229, 0.08)",
  accentBorder:   "rgba(79, 70, 229, 0.35)",

  success:        "#15803d",
  warning:        "#b45309",
  danger:         "#dc2626",
  dangerStrong:   "#b91c1c",
  info:           "#1d4ed8",

  text:           "#0f172a",
  textBody:       "#334155",
  textDim:        "#475569",
  textMuted:      "#64748b",
  textFaint:      "#94a3b8",

  bg:             "#f8fafc",
  cardBg:         "rgba(255, 255, 255, 0.85)",
  cardBgSolid:    "#ffffff",
  cardBorder:     "rgba(15, 23, 42, 0.08)",
  inputBg:        "rgba(15, 23, 42, 0.04)",

  gradFrom:       "#4f46e5",
  gradTo:         "#7c3aed",
};

export const palettes = { dark, light };

// Static default — kept for files that haven't migrated to useTheme() yet.
export const color = dark;

// Self-bundled font faces (loaded in App.js). Body text gets Inter automatically
// via the global Text patch (theme/textScale.js); use `display` for brand
// wordmarks + hero headings to opt INTO Space Grotesk.
export const fontFamily = {
  regular:  "Inter_400Regular",
  medium:   "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold:     "Inter_700Bold",
  display:  "SpaceGrotesk_700Bold",
  displayMedium: "SpaceGrotesk_500Medium",
};

export const radius   = { sm: 12, md: 14, lg: 18, xl: 24, pill: 9999 };
export const spacing  = { xs: 8, sm: 12, md: 16, lg: 22, xl: 30, xxl: 40 };
export const fontSize = { xs: 14, sm: 16, md: 18, lg: 20, xl: 24, xxl: 28, hero: 36 };

export const shadow = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 4,
  },
  magic: {
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
};
