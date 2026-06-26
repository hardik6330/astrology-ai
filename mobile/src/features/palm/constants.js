// Shared constants for PalmScreen + its section components.
import { EMOJIS } from "../../utils/emojis";

// Friendly UI copy for each Gemini rejection category.
export const REJECT_INFO = {
  not_a_palm:     { icon: EMOJIS.THINKING,     title: "That's not a palm",       tip: "Please upload a clear photo of your open hand, palm facing the camera." },
  screen_photo:   { icon: EMOJIS.PROHIBITED,   title: "Don't photograph a screen", tip: "Take a photo of your real hand with the camera — a picture of a screen, monitor, or another photo can't be read." },
  back_of_hand:   { icon: EMOJIS.REFRESH,      title: "Wrong side of the hand",  tip: "Flip your hand so the PALM (not the back) faces the camera." },
  blurry:         { icon: EMOJIS.CAMERA,       title: "Photo is too blurry",     tip: "Hold steady and take a sharp, focused photo of your palm." },
  too_dark:       { icon: EMOJIS.LIGHT_BULB,   title: "Lighting is too dark",    tip: "Move into bright, even light so the lines on your palm are clearly visible." },
  too_far:        { icon: EMOJIS.MAGNIFIER,    title: "Palm is too far away",    tip: "Bring the camera closer — your palm should fill most of the frame." },
  cropped:        { icon: EMOJIS.SCISSORS,     title: "Palm is cropped",         tip: "Include your full palm — from wrist to fingertips — in the photo." },
  multiple_hands: { icon: EMOJIS.HAND,         title: "More than one hand",      tip: "Show just one open palm in the photo." },
  wrong_hand:     { icon: EMOJIS.REPEAT,       title: "Wrong hand uploaded",     tip: "The photo shows your other hand. Please retake using the hand you selected." },
  duplicate_hand: { icon: EMOJIS.REPEAT,       title: "Same hand twice",         tip: "Both slots look like the same hand. Upload your LEFT and RIGHT palms separately." },
  fingers_closed: { icon: EMOJIS.HAND,         title: "Spread your fingers",     tip: "Open your hand and spread your fingers slightly so the full palm is visible." },
  tilted_hand:    { icon: EMOJIS.REFRESH,      title: "Keep your hand straight", tip: "Hold your hand flat and upright (fingers pointing up), facing the camera." },
  obstructed:     { icon: EMOJIS.PROHIBITED,   title: "Palm is blocked",         tip: "Open your hand flat — remove rings, mehndi, or anything covering the main lines." },
  lines_faint:    { icon: EMOJIS.MAGNIFIER,    title: "Palm lines too faint",    tip: "Take a sharp photo of your real hand in bright light — a photo of a screen won't have enough line detail." },
  uneven_light:   { icon: EMOJIS.LIGHT_BULB,   title: "Lighting is uneven",      tip: "Even out the lighting — avoid harsh shadow or glare falling across your palm." },
  default:        { icon: EMOJIS.CAMERA,       title: "Photo unreadable",        tip: "Please retake with a clear, well-lit photo of your open palm." },
};

export const SCAN_MSGS = [
  "Detecting your palm…",
  "Tracing the life line…",
  "Reading the head line…",
  "Examining the heart line…",
  "Following your fate line…",
  "Weaving the reading together…",
];
