// Validate that a base64-encoded image is actually a real JPEG / PNG / WEBP
// by checking the first few decoded bytes (magic numbers). Stops a user from
// uploading a 5MB text file labeled image/jpeg and burning Gemini tokens on it.

export const MAX_BYTES = 4 * 1024 * 1024;   // 4MB on the decoded image

// Magic-byte signatures for the formats we accept.
const SIGNATURES = [
  { mime: 'image/jpeg', bytes: [0xFF, 0xD8, 0xFF] },                           // JPEG
  { mime: 'image/png',  bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] }, // PNG
  // WEBP: "RIFF????WEBP" — bytes 0-3 = RIFF, 8-11 = WEBP
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46], extra: { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] } },
];

function matches(buf, sig) {
  for (let i = 0; i < sig.bytes.length; i++) {
    if (buf[i] !== sig.bytes[i]) return false;
  }
  if (sig.extra) {
    for (let i = 0; i < sig.extra.bytes.length; i++) {
      if (buf[sig.extra.offset + i] !== sig.extra.bytes[i]) return false;
    }
  }
  return true;
}

/**
 * Parse a `data:` URL or raw base64 string into { mime, base64 }.
 * Throws if the payload is not a valid image of an accepted type, or oversized.
 */
export function validateImage(input) {
  if (typeof input !== 'string' || input.length === 0) {
    throw new Error('Image data is missing or not a string.');
  }

  const m = /^data:(image\/[a-zA-Z+]+);base64,(.*)$/s.exec(input);
  const claimedMime = m ? m[1].toLowerCase() : null;
  const base64 = m ? m[2] : input;

  if (base64.length > Math.ceil((MAX_BYTES * 4) / 3) + 100) {
    throw new Error(`Image is too large. Max ${Math.round(MAX_BYTES / 1024 / 1024)}MB.`);
  }

  let buf;
  try {
    buf = Buffer.from(base64.slice(0, 24), 'base64');
  } catch {
    throw new Error('Image is not valid base64.');
  }

  const match = SIGNATURES.find(sig => matches(buf, sig));
  if (!match) {
    throw new Error('Image format not supported. Please upload a JPEG, PNG, or WEBP photo.');
  }

  if (claimedMime && claimedMime !== match.mime) {
    throw new Error('Image type does not match its declared format.');
  }

  return { mime: match.mime, base64 };
}
