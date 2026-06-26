// Pure formatting helpers (dates, ordinals, clock, phase labels). No deps.
// Part of @astrology-ai/core.

export function fmtDate(d) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
export function fmtDay(d) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}


export function ordinal(n) {
  const s = ["th", "st", "nd", "rd"],
    v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}


export function nm(x) {
  return ((x % 360) + 360) % 360;
}

// Build a UTC Date from local birth date/time + timezone offset
  
export function phaseLabel(houses, tone) {
  if (houses.includes(10)) return "Career Activation";
  if (houses.includes(7)) return "Relationship Karma Phase";
  if (houses.includes(4)) return "Foundation Building";
  if (houses.includes(2) || houses.includes(11)) return "Wealth Expansion Window";
  if (houses.includes(9) || houses.includes(12)) return "Expansion Window";
  if (houses.includes(5)) return "Growth Phase";
  if (tone === "testing") return "Pressure + Opportunity";
  return "Transition Phase";
}

export function fmtClock(ms, tz) {
  const d = new Date(ms + tz * 3600000);
  let h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return h + ":" + String(m).padStart(2, "0") + " " + ap;
}
