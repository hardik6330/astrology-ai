// Central design tokens — colors, gradients, glass surfaces, radii, shadows.
// Use these in new components and migrate inline literals over time.
// Color naming follows Tailwind's slate/indigo/violet/amber families so values
// are familiar and Tailwind migration later is trivial.

export const color = {
  // Brand
  primary:        '#a855f7',                              // violet-500
  primaryLight:   '#c084fc',                              // violet-400
  primarySoft:    'rgba(168, 85, 247, 0.15)',
  primaryBorder:  'rgba(168, 85, 247, 0.4)',

  accent:         '#6366f1',                              // indigo-500
  accentLight:    '#a5b4fc',                              // indigo-300
  accentSoft:     'rgba(99, 102, 241, 0.10)',
  accentBorder:   'rgba(99, 102, 241, 0.4)',

  // Status
  success:        '#4ade80',
  warning:        '#fbbf24',
  danger:         '#f87171',
  dangerStrong:   '#ef4444',
  info:           '#60a5fa',

  // Text
  text:           '#ffffff',
  textBody:       '#cbd5e1',
  textDim:        '#94a3b8',
  textMuted:      '#64748b',
  textFaint:      '#475569',

  // Surfaces
  bg:             '#050508',
  cardBg:         'rgba(20, 20, 30, 0.6)',
  cardBorder:     'rgba(255, 255, 255, 0.10)',
  inputBg:        'rgba(255, 255, 255, 0.05)',

  // Gradient stops
  gradFrom:       '#6366f1',
  gradTo:         '#a855f7',
};

export const gradient = {
  magic: `linear-gradient(135deg, ${color.gradFrom} 0%, ${color.gradTo} 100%)`,
  hero:  `linear-gradient(135deg, rgba(99, 102, 241, 0.20) 0%, rgba(168, 85, 247, 0.20) 100%)`,
  text:  `linear-gradient(to right, #fff, ${color.primary})`,
};

export const radius = { sm: 8, md: 10, lg: 14, xl: 18, pill: 9999 };

export const shadow = {
  card:    '0 8px 32px rgba(0, 0, 0, 0.30)',
  magic:   `0 4px 15px rgba(99, 102, 241, 0.30)`,
  magicHi: `0 8px 25px rgba(99, 102, 241, 0.50)`,
  glow:    (c) => `0 0 30px ${c}`,
};

// Reusable style objects for common surfaces — drop into a style={} prop.
export const surface = {
  card: {
    background: color.cardBg,
    border: `1px solid ${color.cardBorder}`,
    borderRadius: radius.lg,
    padding: '1.5rem',
    boxShadow: shadow.card,
  },
};
