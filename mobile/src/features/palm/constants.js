// Shared constants for PalmScreen + its section components.

// Friendly UI copy for each Gemini rejection category.
export const REJECT_INFO = {
  not_a_palm:     { icon: "🤔", title: "That's not a palm",       tip: "Please upload a clear photo of your open hand, palm facing the camera." },
  back_of_hand:   { icon: "🔄", title: "Wrong side of the hand",  tip: "Flip your hand so the PALM (not the back) faces the camera." },
  blurry:         { icon: "📸", title: "Photo is too blurry",     tip: "Hold steady and take a sharp, focused photo of your palm." },
  too_dark:       { icon: "💡", title: "Lighting is too dark",    tip: "Move into bright, even light so the lines on your palm are clearly visible." },
  too_far:        { icon: "🔍", title: "Palm is too far away",    tip: "Bring the camera closer — your palm should fill most of the frame." },
  cropped:        { icon: "✂️", title: "Palm is cropped",         tip: "Include your full palm — from wrist to fingertips — in the photo." },
  multiple_hands: { icon: "✋", title: "More than one hand",      tip: "Show just one open palm in the photo." },
  wrong_hand:     { icon: "🔁", title: "Wrong hand uploaded",     tip: "The photo shows your other hand. Please retake using the hand you selected." },
  obstructed:     { icon: "🚫", title: "Palm is blocked",         tip: "Open your hand flat — remove rings, mehndi, or anything covering the main lines." },
  default:        { icon: "📸", title: "Photo unreadable",        tip: "Please retake with a clear, well-lit photo of your open palm." },
};

export const SCAN_MSGS = [
  "Detecting your palm…",
  "Tracing the life line…",
  "Reading the head line…",
  "Examining the heart line…",
  "Following your fate line…",
  "Weaving the reading together…",
];
