// Central emoji constants for the mobile app — mirrors the web app's
// frontend/src/utils/emojis.js so both clients share one vocabulary. Use these
// for SEMANTIC / reused icons (tab icons, sign cards, status glyphs). Purely
// decorative one-off emoji can stay inline; this isn't meant to wrap every glyph.
//
// NOTE: some glyphs carry a trailing variation selector (e.g. "⚠️") — keep the
// exact string when referencing, don't retype by hand.

export const EMOJIS = {
  // Common UI
  SPARKLES: "✨",
  ARROW_UP_RIGHT: "↗",
  ARROW_UP: "⬆",
  WARNING: "⚠️",
  LEFT_ARROW: "←",
  NAMASTE: "🙏",
  CALENDAR: "📅",
  CLOCK: "🕒",
  CRYSTAL_BALL: "🔮",
  CHAT: "💬",
  PERSON: "🧑",
  CHEVRON_RIGHT: "›",
  DIYA: "🪔",
  KUNDLI: "🔯",
  SATURN: "🪐",
  USER: "👤",
  HOUSE: "🏠",
  HELP_DESK: "💁",
  PARTY: "🎉",
  ENVELOPE: "✉️",
  GLOBE: "🌐",
  REFRESH: "🔄",
  LIGHT_BULB: "💡",
  MAGNIFIER: "🔍",
  PROHIBITED: "🚫",
  EDIT: "✏️",
  ROCKET: "🚀",
  DOOR: "🚪",
  THINKING: "🤔",
  CHECK: "✓",
  CROSS: "✗",
  STAR4: "✦",
  TARGET: "🎯",
  LEAF: "🌿",

  // Palm / hands + camera
  HAND: "✋",
  HAND_OPEN: "🖐️",
  HAND_LEFT: "🤚",
  CAMERA: "📸",
  CAMERA_LENS: "📷",
  GALLERY: "🖼️",
  HOURGLASS: "⏳",

  // Astrology / sign cards
  SUN_FACE: "☀️",
  MOON: "🌙",
  HEART_YELLOW: "💛",
  BRIEFCASE: "💼",
  RING: "💍",
  PIN: "📍",

  // Palm reading — line icons + gate / reject reasons
  BRAIN: "🧠",
  SCROLL: "📜",
  FOLDER: "📂",
  SCISSORS: "✂️",
  REPEAT: "🔁",
};
