// Central vector-icon registry — replaces the old emoji map (utils/emojis.js).
//
// Why: color emoji render as different glyphs per OS/browser, can't be themed,
// and clash with the dark/violet palette. Lucide line icons inherit currentColor,
// scale crisply, and align to text — one consistent look everywhere.
//
// Usage:
//   import { Icon } from "@/utils/icons";
//   <Icon name="SPARKLES" size={16} className="text-primary" />
//
// For zodiac signs / planets there is no Lucide equivalent, so those stay as
// their meaningful astrological symbols, centralized + themed via <AstroGlyph>.
import {
  LuSparkles,
  LuArrowUpRight,
  LuArrowUp,
  LuArrowLeft,
  LuTriangleAlert,
  LuHandHeart,
  LuCalendarDays,
  LuClock,
  LuMoonStar,
  LuMessageCircle,
  LuUser,
  LuUsers,
  LuChevronRight,
  LuFlame,
  LuOrbit,
  LuHand,
  LuGem,
  LuBriefcase,
  LuCoins,
  LuMapPin,
  LuZap,
  LuStar,
  LuMoon,
  LuSunrise,
  LuTelescope,
  LuFlower2,
  LuTrendingUp,
  LuTrendingDown,
  LuShieldCheck,
  LuHouse,
  LuHeart,
  LuGraduationCap,
  LuScale,
  LuPuzzle,
  LuRefreshCw,
  LuRotateCw,
  LuRepeat,
  LuLightbulb,
  LuSearch,
  LuScissors,
  LuBan,
  LuCamera,
  LuPencil,
  LuLogOut,
  LuImage,
  LuFolderOpen,
  LuHourglass,
  LuKey,
  LuRuler,
  LuSmartphone,
  LuLock,
  LuLeaf,
  LuBrain,
  LuTarget,
  LuCheck,
  LuX,
} from "react-icons/lu";
import { TbPlanet } from "react-icons/tb";
import { IoHandLeftOutline, IoHandRightOutline } from "react-icons/io5";

// name → Lucide component. Keys mirror the old EMOJIS map so call sites read the
// same intent (e.g. EMOJIS.SPARKLES → <Icon name="SPARKLES" />), plus a few extra
// keys for emoji that were typed inline rather than via the map.
const ICON_MAP = {
  SPARKLES: LuSparkles,
  ARROW_UP_RIGHT: LuArrowUpRight,
  ARROW_UP: LuArrowUp,
  LEFT_ARROW: LuArrowLeft,
  WARNING: LuTriangleAlert,
  NAMASTE: LuHandHeart,
  CALENDAR: LuCalendarDays,
  CLOCK: LuClock,
  CRYSTAL_BALL: LuMoonStar,
  CHAT: LuMessageCircle,
  PERSON: LuUser,
  USER: LuUser,
  COUPLE: LuUsers,
  CHEVRON_RIGHT: LuChevronRight,
  DIYA: LuFlame,
  FIRE: LuFlame,
  KUNDLI: LuOrbit,
  GALAXY: LuOrbit,
  SATURN: LuOrbit,
  HAND: LuHand,
  HAND_OPEN: LuHand,
  HAND_LEFT: IoHandLeftOutline,
  HAND_RIGHT: IoHandRightOutline,
  HANDS: LuHand,
  RING: LuGem,
  BRIEFCASE: LuBriefcase,
  MONEY: LuCoins,
  PIN: LuMapPin,
  BOLT: LuZap,
  STAR: LuStar,
  MOON: LuMoon,
  SUN: LuSunrise,
  TELESCOPE: LuTelescope,
  MEDITATION: LuFlower2,
  CHART_UP: LuTrendingUp,
  CHART_DOWN: LuTrendingDown,
  SHIELD: LuShieldCheck,
  HOUSE: LuHouse,
  HEART: LuHeart,
  HEART_YELLOW: LuHeart,
  GRADUATION: LuGraduationCap,
  BALANCE: LuScale,
  PUZZLE: LuPuzzle,
  REFRESH: LuRefreshCw,
  ROTATE: LuRotateCw,
  REPEAT: LuRepeat,
  LIGHT_BULB: LuLightbulb,
  MAGNIFIER: LuSearch,
  SCISSORS: LuScissors,
  PROHIBITED: LuBan,
  CAMERA: LuCamera,
  EDIT: LuPencil,
  LOGOUT: LuLogOut,
  GALLERY: LuImage,
  FOLDER: LuFolderOpen,
  HOURGLASS: LuHourglass,
  KEY: LuKey,
  RULER: LuRuler,
  MOBILE: LuSmartphone,
  LOCK: LuLock,
  LEAF: LuLeaf,
  BRAIN: LuBrain,
  TARGET: LuTarget,
  CHECK: LuCheck,
  CROSS: LuX,
  PLANET: TbPlanet, // ringed-planet glyph (Tabler) — used for the Planets tab
};

// Generic icon. Falls back to LuSparkles if a name is unmapped (so a typo renders
// a visible placeholder instead of throwing).
export function Icon({ name, size = 16, className = "", ...rest }) {
  const Cmp = ICON_MAP[name] || LuSparkles;
  return <Cmp size={size} className={className} aria-hidden="true" {...rest} />;
}

// Astrological symbols (zodiac signs, planet glyphs) have no vector-icon
// equivalent — they ARE the notation. Render the symbol as a crisp, themed,
// monochrome glyph (U+FE0E forces the text/line presentation, never color emoji).
const VS_TEXT = String.fromCharCode(0xfe0e);
export function AstroGlyph({ symbol, size = 16, className = "", style }) {
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{ fontSize: size, lineHeight: 1.4, display: "inline-block", ...style }}
    >
      {symbol + VS_TEXT}
    </span>
  );
}
