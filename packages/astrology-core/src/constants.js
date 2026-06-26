// Deterministic data tables + math constants for the chart engine. Pure
// literals, no imports — the single source of the fixed astrological meanings
// (signs, nakshatras, dignities, dasha lengths, etc.). Imported by astronomy.js,
// engines.js and astrology.js. Part of @astrology-ai/core (see astrology.js).

export const D2R = Math.PI / 180,
  R2D = 180 / Math.PI,
  YEAR_MS = 31557600000;

export const SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
];
export const ZE = {
  Aries: "♈",
  Taurus: "♉",
  Gemini: "♊",
  Cancer: "♋",
  Leo: "♌",
  Virgo: "♍",
  Libra: "♎",
  Scorpio: "♏",
  Sagittarius: "♐",
  Capricorn: "♑",
  Aquarius: "♒",
  Pisces: "♓",
};
export const NAKSHATRAS = [
  "Ashwini",
  "Bharani",
  "Krittika",
  "Rohini",
  "Mrigashira",
  "Ardra",
  "Punarvasu",
  "Pushya",
  "Ashlesha",
  "Magha",
  "Purva Phalguni",
  "Uttara Phalguni",
  "Hasta",
  "Chitra",
  "Swati",
  "Vishakha",
  "Anuradha",
  "Jyeshtha",
  "Mula",
  "Purva Ashadha",
  "Uttara Ashadha",
  "Shravana",
  "Dhanishta",
  "Shatabhisha",
  "Purva Bhadrapada",
  "Uttara Bhadrapada",
  "Revati",
];

/* ── DETERMINISTIC RULE TABLES — fixed astrological meanings ── */
export const PLANET_DOMAIN = {
  Sun: "core self, ego, vitality, father",
  Moon: "mind, emotions, mother, instincts",
  Mercury: "intellect, communication, learning",
  Venus: "love, beauty, relationships, comfort",
  Mars: "energy, drive, courage, conflict",
  Jupiter: "wisdom, growth, fortune, beliefs",
  Saturn: "discipline, limits, responsibility, karma",
  Uranus: "change, rebellion, sudden insight",
  Neptune: "dreams, spirituality, illusion",
  Pluto: "transformation, power, depth",
  Rahu: "ambition, obsession, worldly desire",
  Ketu: "detachment, spirituality, past karma",
};

export const SIGN_QUALITY = {
  Aries: "bold, pioneering, impulsive, action-driven",
  Taurus: "steady, sensual, patient, security-seeking",
  Gemini: "curious, communicative, versatile, restless",
  Cancer: "nurturing, emotional, protective, home-oriented",
  Leo: "confident, expressive, proud, leadership-driven",
  Virgo: "analytical, precise, service-minded, self-critical",
  Libra: "harmonious, relational, fair-minded, indecisive",
  Scorpio: "intense, secretive, transformative, strong-willed",
  Sagittarius: "expansive, philosophical, freedom-loving, optimistic",
  Capricorn: "disciplined, ambitious, pragmatic, reserved",
  Aquarius: "innovative, humanitarian, independent, unconventional",
  Pisces: "compassionate, imaginative, intuitive, escapist",
};

export const HOUSE_AREA = {
  1: "self, body, personality, life direction",
  2: "wealth, family, speech, values",
  3: "courage, siblings, communication, effort",
  4: "home, mother, roots, inner peace",
  5: "creativity, children, romance, intelligence",
  6: "health, daily work, service, obstacles",
  7: "marriage, partnerships, business",
  8: "transformation, secrets, longevity, sudden change",
  9: "fortune, dharma, higher learning, father, beliefs",
  10: "career, status, public life, achievement",
  11: "gains, networks, aspirations, friends",
  12: "loss, expenses, spirituality, foreign lands, solitude",
};

// readable theme phrases per house — for synthesised timeline summaries
export const HOUSE_THEME = {
  1: "a renewed self-image and personal direction",
  2: "family wealth, savings and what you value",
  3: "bold initiative, skill-building and communication",
  4: "home, property and emotional roots",
  5: "creativity, romance, learning and self-expression",
  6: "work, service, health and overcoming obstacles",
  7: "partnership, marriage and one-to-one dealings",
  8: "deep change, shared resources and hidden matters",
  9: "higher learning, travel, fortune and belief",
  10: "career, status and public visibility",
  11: "gains, goals, networks and friendships",
  12: "foreign lands, spirituality, retreat and letting go",
};

export const ASPECT_QUALITY = {
  Conjunction: "intensely fuses the energies of",
  Sextile: "creates supportive opportunity between",
  Square: "creates productive tension between",
  Trine: "lets energy flow harmoniously between",
  Opposition: "creates a balancing polarity between",
};

export const SIGN_LORD = {
  Aries: "Mars",
  Taurus: "Venus",
  Gemini: "Mercury",
  Cancer: "Moon",
  Leo: "Sun",
  Virgo: "Mercury",
  Libra: "Venus",
  Scorpio: "Mars",
  Sagittarius: "Jupiter",
  Capricorn: "Saturn",
  Aquarius: "Saturn",
  Pisces: "Jupiter",
};

export const DIGNITY = {
  Sun: { own: ["Leo"], exalt: "Aries", debil: "Libra" },
  Moon: { own: ["Cancer"], exalt: "Taurus", debil: "Scorpio" },
  Mercury: { own: ["Gemini", "Virgo"], exalt: "Virgo", debil: "Pisces" },
  Venus: { own: ["Taurus", "Libra"], exalt: "Pisces", debil: "Virgo" },
  Mars: { own: ["Aries", "Scorpio"], exalt: "Capricorn", debil: "Cancer" },
  Jupiter: { own: ["Sagittarius", "Pisces"], exalt: "Cancer", debil: "Capricorn" },
  Saturn: { own: ["Capricorn", "Aquarius"], exalt: "Libra", debil: "Aries" },
};


export const DASHA_LEN = {
  Ketu: 7,
  Venus: 20,
  Sun: 6,
  Moon: 10,
  Mars: 7,
  Rahu: 18,
  Jupiter: 16,
  Saturn: 19,
  Mercury: 17,
};
export const DASHA_ORDER = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"];
