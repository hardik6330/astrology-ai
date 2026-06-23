// Static data + constants for the marketing landing page. Kept separate from the
// page composition so the section markup reads cleanly and these lists are easy
// to edit. Icons are stored as component references and rendered by the sections.
import {
  LuSparkles,
  LuHand,
  LuMessageCircle,
  LuCalendarDays,
  LuShieldCheck,
  LuBell,
  LuZap,
  LuScan,
  LuOrbit,
  LuSunrise,
  LuSun,
  LuSunset,
  LuMoon,
} from "react-icons/lu";

// App download targets. Point QR + badges at the live store listings once they
// exist; until then they go to the site, which can device-detect and redirect.
export const APP_LINK = "https://selora.mooo.com/app";
export const APP_STORE_URL = "https://selora.mooo.com/app"; // TODO: App Store listing
export const PLAY_STORE_URL = "https://selora.mooo.com/app"; // TODO: Play Store listing

export const APP_PERKS = [
  { i: LuScan, t: "Scan your palm with the camera" },
  { i: LuBell, t: "Daily guidance, delivered to you" },
  { i: LuZap, t: "Fast, and works offline anywhere" },
  { i: LuShieldCheck, t: "Private, secure sign-in" },
];

// Crisp foreground twinkle stars (deterministic positions — same approach as the
// login CosmicBackdrop). Rendered as glowing DOM dots over the drifting starfield.
export const TWINKLE_STARS = Array.from({ length: 18 }, (_, i) => ({
  l: `${(i * 61) % 100}%`,
  t: `${(i * 37) % 97}%`,
  s: `${(i % 3) + 1}px`,
  d: `${((i * 0.37) % 4).toFixed(2)}s`,
}));

// 12 zodiac glyphs, Aries → Pisces — the same set the mobile app's splash wheel
// uses (mobile/src/components/SplashScreen.js), rendered in the same warm cream.
// Each carries U+FE0E (text-presentation selector) so browsers draw the
// monochrome LINE glyph (which respects `fill`) instead of a color-emoji box.
const VS_TEXT = String.fromCharCode(0xfe0e); // U+FE0E text-presentation selector
export const RASHI = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"].map(
  (g) => g + VS_TEXT
);

// Bento feature tiles. `span` controls the asymmetric grid footprint (different
// sizes = no two tiles read the same). Every feature listed is real.
export const BENTO = [
  {
    icon: LuMessageCircle,
    title: "AI Astrologer Chat",
    desc: "Ask about career, love, money, or timing. Grounded in your real chart, it remembers your prior questions and even folds in your palm reading.",
    span: "sm:col-span-2 sm:row-span-2",
    big: true,
  },
  {
    icon: LuSparkles,
    title: "Birth Chart (Kundli)",
    desc: "A complete Vedic chart with a clear, personal reading — life theme, career, relationships, strengths, and remedies.",
  },
  {
    icon: LuHand,
    title: "AI Palm Reading",
    desc: "Snap a photo of your hand for a structured reading. We show the measured geometry — never invented numbers — and your photo is never stored.",
  },
  {
    icon: LuCalendarDays,
    title: "Daily Predictions",
    desc: "Guidance mapped to the real sky for any day — Moon transit, lucky colour & number, auspicious windows, and Rahu Kaal.",
    span: "sm:col-span-2",
  },
  {
    icon: LuOrbit,
    title: "Live Transits (Gochar)",
    desc: "A dual wheel of your birth planets against today's live sky, with the active alignments that matter right now.",
  },
];

// Sample thread rendered inside the large "AI Astrologer Chat" bento tile —
// a fuller back-and-forth so it reads like a real conversation. `me` = the user.
export const BENTO_CHAT = [
  { me: true, t: "Is this a good year to switch jobs?" },
  {
    me: false,
    t: "Your 10th-house Saturn favours a planned move over a sudden one — here's the placement behind that.",
  },
  { me: true, t: "When will my money situation improve?" },
  {
    me: false,
    t: "Jupiter enters your 2nd house of wealth this autumn — income usually picks up once it does.",
  },
  { me: true, t: "And marriage? My family keeps asking." },
  {
    me: false,
    t: "Venus rules your 7th house; a strong window opens next spring, during your Venus sub-period.",
  },
  { me: true, t: "Should I be worried about my health?" },
  {
    me: false,
    t: "Nothing alarming — just watch stress around the Mars transit in late summer. Rest and routine help.",
  },
  { me: true, t: "Which day this week is lucky for me?" },
  {
    me: false,
    t: "Thursday — your Moon is well-placed and it's a Jupiter day. Good for starting something new.",
  },
  { me: true, t: "Any remedy you'd suggest?" },
  {
    me: false,
    t: "Keep a simple Saturn routine — discipline on Saturdays. I'll tailor more once I read your full chart.",
  },
];

export const STEPS = [
  {
    n: "01",
    t: "Share your birth details",
    d: "Just your date, time, and place of birth — that's all it takes to get started.",
  },
  {
    n: "02",
    t: "Get your personalized reading",
    d: "Your complete birth chart and a clear, personal reading — accurate and ready in seconds.",
  },
  {
    n: "03",
    t: "Explore and ask anything",
    d: "Dive into daily guidance, scan your palm, and chat with your personal AI astrologer anytime.",
  },
];

// Day-rhythm guidance timeline. These are FORMAT examples (labelled as such on
// the page) — the kind of windows a daily reading surfaces, not personal claims.
export const DAY_PARTS = [
  { i: LuSunrise, k: "Morning", d: "Moon enters a calm phase — a good window for planning and intentions." },
  { i: LuSun, k: "Midday", d: "Favourable for important conversations and decisions you've been holding." },
  { i: LuSunset, k: "Evening", d: "Note your Rahu Kaal window — best to avoid brand-new starts in it." },
  {
    i: LuMoon,
    k: "Night",
    d: "Wind down and reflect; the reading flags what worked and what to carry forward.",
  },
];

export const FAQS = [
  {
    q: "How accurate is the reading?",
    a: "Your chart is computed from real astronomical positions for your exact birth date, time, and place — not guessed. Every insight shows the placement behind it, so you can see the reasoning instead of taking it on faith.",
  },
  {
    q: "How does AI astrology actually work here?",
    a: "We calculate your Vedic birth chart locally, then the AI interprets those real facts. Free chatbots invent a chart from thin air; Selora reads from an accurate one and stays grounded in it.",
  },
  {
    q: "Is my palm photo or data stored?",
    a: "No. Your palm image is used only to produce your reading and is then discarded — we keep a one-way hash and the text reading, never the picture. Your details are never sold or used to train anything.",
  },
  {
    q: "What does it cost?",
    a: "Your first reading is free — no card needed. After that it's simple pay-as-you-go credits you top up only when you want more. No subscription, nothing recurring.",
  },
];
