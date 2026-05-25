// Stored interpretation/guidance/reading may be a parsed object (new rows) or a
// raw JSON string (older rows). Always hand the frontend a single-encoded JSON
// string it can parse exactly once — never double-encode an existing string.
export function asContent(value) {
  return typeof value === 'string' ? value : JSON.stringify(value);
}
