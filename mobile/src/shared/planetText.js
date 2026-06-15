// Plain-English display names for the two lunar nodes. Rahu/Ketu are the only
// graha names without an English form (the rest — Sun..Saturn — already are);
// the data layer keeps "Rahu"/"Ketu" as keys, so we translate only for display.
// Keep in sync with the web twin (frontend/src/shared/planetText.js).

const PLANET_EN = { Rahu: "North Node", Ketu: "South Node" };

export const planetEnglish = (name) => PLANET_EN[name] || name;

// "Rahu – Jupiter" → "North Node – Jupiter" (display only; the raw period string
// stays the guidance-lookup key, so never mutate the data with this). Replaces
// the node tokens in place so it's independent of the dash/separator used.
export const periodEnglish = (period) =>
  typeof period === "string" ? period.replace(/\b(Rahu|Ketu)\b/g, (m) => PLANET_EN[m]) : period;
