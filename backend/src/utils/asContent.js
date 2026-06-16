import { cleanJson } from './cleanJson.js';

// Stored interpretation/guidance/reading may be a parsed object (new rows) or a
// raw JSON string (older rows). Always hand the frontend a real parsed OBJECT so
// the API returns proper JSON instead of a stringified blob. Falls back to the
// raw value if it somehow isn't valid JSON (never throws on a response path).
export function asContent(value) {
  if (value == null) return null;
  if (typeof value !== 'string') return value; // already an object (new rows)
  try {
    let parsed = JSON.parse(cleanJson(value));
    // Guard against double-encoded legacy rows (a JSON string of a JSON string).
    if (typeof parsed === 'string') parsed = JSON.parse(parsed);
    return parsed;
  } catch {
    return value; // not JSON (shouldn't happen) — return as-is rather than throw
  }
}
