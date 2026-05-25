// Sanitize a JSON string the LLM produced before parsing or returning to the
// client. Strips markdown fences and the most common offender — trailing
// commas — which Gemini occasionally emits and which strict JSON.parse rejects.
export function cleanJson(s) {
  if (typeof s !== 'string') return s;
  return s
    .replace(/```json|```/g, '')
    // Trailing comma before `}` or `]` (with any whitespace).
    .replace(/,(\s*[}\]])/g, '$1')
    .trim();
}
