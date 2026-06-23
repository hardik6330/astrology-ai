// Static Vedic-planet reference + dasha Do's/Don'ts for the interactive reading
// UI (planet detail modal, expandable dasha cards). Keyed by the planet's BASE
// name (chart planets store `p.base`, e.g. "Rahu" from "Rahu (N.Node)"). Content
// is fixed astrological meaning — placement/period specifics are filled in from
// the live chart, so nothing here is invented per-user.
//
// ⚠️ TWIN of mobile/src/features/reading/planetInfo.js — keep the two in sync
// (same rule as the astrology engine / palm gate).

export const PLANET_INFO = {
  Sun: {
    vedic: "Surya",
    epithet: "The Soul & Authority",
    glyph: "☉",
    represents: "Self, ego, vitality, father, leadership, government, and the core identity you radiate.",
    strong: "Confidence, purpose, natural command, good health and recognition.",
    weak: "Low self-worth, ego friction with authority, strained bond with father.",
  },
  Moon: {
    vedic: "Chandra",
    epithet: "The Mind & Emotions",
    glyph: "☽",
    represents: "Mind, emotions, mother, intuition, comfort, and how you nurture and feel.",
    strong: "Emotional steadiness, empathy, popularity, a calm and adaptable mind.",
    weak: "Mood swings, restlessness, over-sensitivity, emotional dependence.",
  },
  Mars: {
    vedic: "Mangal",
    epithet: "The Warrior & Drive",
    glyph: "♂",
    represents: "Energy, courage, discipline, siblings, property, and how you assert and act.",
    strong: "Drive, decisiveness, physical stamina, courage under pressure.",
    weak: "Anger, impatience, conflict, accidents or impulsive risk-taking.",
  },
  Mercury: {
    vedic: "Budha",
    epithet: "The Communicator",
    glyph: "☿",
    represents: "Intellect, speech, logic, commerce, learning, and how you process and express.",
    strong: "Sharp wit, eloquence, business sense, quick analytical thinking.",
    weak: "Scattered focus, nervous speech, indecision, miscommunication.",
  },
  Jupiter: {
    vedic: "Guru / Brihaspati",
    epithet: "The Teacher of Wisdom",
    glyph: "♃",
    represents: "Wisdom, growth, fortune, teachers, children, ethics, and higher knowledge.",
    strong: "Optimism, good guidance, wealth, faith, respected counsel.",
    weak: "Over-indulgence, blind optimism, weak judgment, missed opportunity.",
  },
  Venus: {
    vedic: "Shukra",
    epithet: "Love & Beauty",
    glyph: "♀",
    represents: "Love, relationships, beauty, art, luxury, comfort, and what you value.",
    strong: "Charm, artistic talent, harmony in love, refined taste, comfort.",
    weak: "Indulgence, relationship turbulence, vanity, attachment to pleasure.",
  },
  Saturn: {
    vedic: "Shani",
    epithet: "The Teacher of Karma",
    glyph: "♄",
    represents: "Discipline, time, responsibility, hard work, limits, and lessons through delay.",
    strong: "Endurance, integrity, mastery through patience, lasting success.",
    weak: "Delay, fear, isolation, heavy burdens, slow but unavoidable lessons.",
  },
  Rahu: {
    vedic: "Rahu (North Node)",
    epithet: "The Insatiable Desire",
    glyph: "☊",
    represents: "Ambition, obsession, worldly desire, foreign things, and sudden unconventional gains.",
    strong: "Bold ambition, innovation, breakthroughs, magnetism, worldly rise.",
    weak: "Obsession, confusion, illusion, risky shortcuts, never feeling enough.",
  },
  Ketu: {
    vedic: "Ketu (South Node)",
    epithet: "Detachment & Moksha",
    glyph: "☋",
    represents: "Spirituality, detachment, past-life karma, intuition, and letting go.",
    strong: "Insight, spiritual depth, mastery from the past, sharp intuition.",
    weak: "Detachment, confusion, feeling lost or disconnected in worldly matters.",
  },
};

// Resolve a chart planet (name like "Rahu (N.Node)" or "Sun") to its entry.
export function planetInfoFor(planet) {
  if (!planet) return null;
  const key = planet.base || String(planet.name || "").split(" ")[0];
  return PLANET_INFO[key] || null;
}

// Static Do's / Don'ts per dasha-lord. Behavioral guidance for the planetary
// period — generic to the ruling planet (not per-user), so it's instant and
// free. Used by the expandable Timeline forecast cards.
export const DASHA_GUIDANCE = {
  Sun: {
    dos: [
      "Step into leadership roles",
      "Build ties with mentors and authority",
      "Prioritize health and vitality",
    ],
    donts: [
      "Let ego drive decisions",
      "Clash with bosses or your father",
      "Overwork to the point of burnout",
    ],
  },
  Moon: {
    dos: ["Tend to home, family and mind", "Trust your intuition", "Build emotional routines"],
    donts: ["Make choices while emotional", "Neglect rest or self-care", "Cling to the past"],
  },
  Mars: {
    dos: ["Act on long-delayed goals", "Channel energy into training or work", "Be decisive and courageous"],
    donts: ["React in anger or haste", "Pick fights or take rash risks", "Ignore safety in physical tasks"],
  },
  Mercury: {
    dos: ["Learn, write, negotiate, trade", "Sign deals and network", "Use logic over emotion"],
    donts: ["Overthink into indecision", "Speak carelessly", "Scatter focus across too much"],
  },
  Jupiter: {
    dos: ["Invest in learning and ethics", "Seek mentors and teach others", "Expand — career, family, faith"],
    donts: ["Over-promise or over-indulge", "Assume luck without effort", "Ignore practical detail"],
  },
  Venus: {
    dos: ["Nurture love and partnerships", "Pursue art, beauty and comfort", "Value harmony and fairness"],
    donts: ["Over-indulge in pleasure", "Avoid hard conversations", "Tie self-worth to looks or money"],
  },
  Saturn: {
    dos: ["Work hard, stay disciplined", "Be patient — results come slowly", "Honor duty and structure"],
    donts: ["Expect quick rewards", "Cut corners or dodge responsibility", "Isolate yourself in fear"],
  },
  Rahu: {
    dos: [
      "Pursue bold, unconventional goals",
      "Embrace tech, foreign or new fields",
      "Stay grounded amid ambition",
    ],
    donts: ["Chase shortcuts or schemes", "Let obsession consume you", "Lose touch with what's real"],
  },
  Ketu: {
    dos: ["Go inward — reflect and meditate", "Simplify and release attachments", "Trust deep intuition"],
    donts: ["Force worldly outcomes", "Ignore practical duties", "Drift without direction"],
  },
};

// Antardasha lord drives the active sub-period; the period string is
// "Maha – Antar" (e.g. "Saturn – Jupiter"). Fall back to the maha lord.
export function dashaGuidanceFor(period) {
  if (!period) return null;
  const parts = String(period)
    .split("–")
    .map((x) => x.trim());
  const lord = parts[parts.length - 1] || parts[0];
  return DASHA_GUIDANCE[lord] || null;
}
