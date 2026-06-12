// Shared constants for the palm feature: rejection copy, scan ticker lines,
// gate timeouts, and the presentation classes reused across the single-hand
// and compare views. Mirrors mobile's features/palm/constants.js role.

import { EMOJIS } from "@/utils/emojis";

// We wait for the gate MODEL to load (one-time TFJS download) before scanning,
// so the gate reliably produces the hand landmarks the palm-geometry hint needs —
// rather than racing a timeout that would drop them. The load gets a generous
// budget; the gate inference itself is fast once the model is ready. Only a
// genuine load failure (beyond MODEL_READY_TIMEOUT_MS) falls back to the
// backend gate (no landmarks).
export const MODEL_READY_TIMEOUT_MS = 25000; // one-time model download
export const GATE_INFER_TIMEOUT_MS = 8000; // per-photo inference (model already warm)

// Friendly UI copy for each rejection category Gemini can return.
export const REJECT_INFO = {
  not_a_palm: {
    icon: EMOJIS.PUZZLE,
    title: "That's not a palm",
    tip: "Please upload a clear photo of your open hand, palm facing the camera.",
  },
  screen_photo: {
    icon: EMOJIS.PROHIBITED,
    title: "Don't photograph a screen",
    tip: "Take a photo of your real hand with the camera — pictures of a screen, monitor, or another photo can't be read.",
  },
  back_of_hand: {
    icon: EMOJIS.REFRESH,
    title: "Wrong side of the hand",
    tip: "Flip your hand so the PALM (not the back) faces the camera.",
  },
  blurry: {
    icon: EMOJIS.CAMERA,
    title: "Photo is too blurry",
    tip: "Hold steady and take a sharp, focused photo of your palm.",
  },
  too_dark: {
    icon: EMOJIS.LIGHT_BULB,
    title: "Lighting is too dark",
    tip: "Move into bright, even light so the lines on your palm are clearly visible.",
  },
  too_far: {
    icon: EMOJIS.MAGNIFIER,
    title: "Palm is too far away",
    tip: "Bring the camera closer — your palm should fill most of the frame.",
  },
  cropped: {
    icon: EMOJIS.SCISSORS,
    title: "Palm is cropped",
    tip: "Include your full palm — from wrist to fingertips — in the photo.",
  },
  multiple_hands: {
    icon: EMOJIS.HAND_OPEN,
    title: "More than one hand",
    tip: "Show just one open palm in the photo.",
  },
  wrong_hand: {
    icon: EMOJIS.REPEAT,
    title: "Wrong hand uploaded",
    tip: "The photo shows your other hand. Please retake using the hand you selected.",
  },
  obstructed: {
    icon: EMOJIS.PROHIBITED,
    title: "Palm is blocked",
    tip: "Open your hand flat — remove rings, mehndi, or anything covering the main lines.",
  },
  lines_faint: {
    icon: EMOJIS.MAGNIFIER,
    title: "Palm lines too faint",
    tip: "Take a sharp photo of your real hand in bright light so the fine lines stand out — a photo of a screen or another picture won't have enough detail.",
  },
  uneven_light: {
    icon: EMOJIS.LIGHT_BULB,
    title: "Lighting is uneven",
    tip: "Even out the lighting — avoid harsh shadow or glare falling across your palm.",
  },
  default: {
    icon: EMOJIS.CAMERA,
    title: "Photo unreadable",
    tip: "Please retake with a clear, well-lit photo of your open palm.",
  },
};

export const SCAN_MSGS = [
  "Detecting your palm…",
  "Tracing the life line…",
  "Reading the head line…",
  "Examining the heart line…",
  "Following your fate line…",
  "Weaving the reading together…",
];

// Shared presentation classes (kept DRY across the compare + single-hand views).
export const BLUEPRINT =
  "mb-6 rounded-[20px] border border-[rgba(168,85,247,0.3)] bg-[linear-gradient(135deg,rgba(99,102,241,0.2)_0%,rgba(168,85,247,0.2)_100%)] p-[clamp(1.25rem,5vw,2rem)] text-center shadow-[0_0_30px_rgba(168,85,247,0.15)]";
export const BLUEPRINT_QUOTE =
  "m-0 text-[clamp(15px,4.2vw,19px)] font-semibold leading-[1.6] text-ink italic";
export const LINE_TITLE = "m-0 text-[15px] font-bold tracking-[0.5px] text-ink";
export const BULLET_ROW = "mb-2 flex gap-2.5 text-[13.5px] leading-[1.5] text-dim";
export const DISCLAIMER = "mx-auto mt-8 mb-0 max-w-125 text-center text-[11px] leading-[1.8] text-[#444]";
