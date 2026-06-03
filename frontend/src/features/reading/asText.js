// LLM output can drift from the requested JSON schema — e.g. a lite model
// returning bigThree as an object instead of a string. Coerce any value into
// renderable text so React never gets handed a raw object.
export function asText(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(asText).join(" ");
  if (typeof v === "object") return Object.values(v).map(asText).join(" ");
  return String(v);
}
