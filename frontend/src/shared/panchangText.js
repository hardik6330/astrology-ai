// Plain-English rendering for Panchang values. The chart engine returns the
// tithi as "<Paksha> Paksha · <TithiName>" (e.g. "Krishna Paksha · Panchami");
// here we turn the translatable parts into English while leaving genuine proper
// nouns (nakshatra / yoga / karana names) untouched — they have no English name.
// Keep this file in sync with the mobile twin (mobile/src/shared/panchangText.js).

// The 15 lunar days → ordinal day; the 15th is the full/new moon.
const TITHI_EN = {
  Pratipada: "Day 1",
  Dwitiya: "Day 2",
  Tritiya: "Day 3",
  Chaturthi: "Day 4",
  Panchami: "Day 5",
  Shashti: "Day 6",
  Saptami: "Day 7",
  Ashtami: "Day 8",
  Navami: "Day 9",
  Dashami: "Day 10",
  Ekadashi: "Day 11",
  Dwadashi: "Day 12",
  Trayodashi: "Day 13",
  Chaturdashi: "Day 14",
  Purnima: "Full Moon",
  Amavasya: "New Moon",
};

// "Krishna Paksha · Panchami" → "Waning Moon · Day 5"
export function tithiEnglish(tithi) {
  if (!tithi) return tithi;
  const [paksha, name] = tithi.split(" Paksha · ");
  if (!name) return tithi; // unexpected format — show raw rather than break
  const phase = paksha === "Shukla" ? "Waxing Moon" : "Waning Moon";
  return `${phase} · ${TITHI_EN[name] || name}`;
}
