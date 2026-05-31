// Shared constants + helpers for the Reading screen and its tab sections.

// Coerce any LLM value into renderable text (some lite models return objects).
export function asText(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(asText).join(" ");
  if (typeof v === "object") return Object.values(v).map(asText).join(" ");
  return String(v);
}

export const WD_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
export const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export const SUB_TABS = ["kundali", "planets", "timeline", "reading", "palm", "chat", "profile"];

export const iso = (d) => d.toISOString().split("T")[0];
