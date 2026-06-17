// Validate that a base64-encoded image is actually a real JPEG / PNG / WEBP
// by checking the first few decoded bytes (magic numbers). Stops a user from
// uploading a 5MB text file labeled image/jpeg and burning Gemini tokens on it.

export const MAX_BYTES = 4 * 1024 * 1024;   // 4MB on the decoded image

// M5: decompression-bomb guard. A small (<4MB) file can still encode an enormous
// bitmap (e.g. a 30000×30000 solid-color PNG → gigabytes once Jimp decodes it).
// We parse the declared dimensions from the file HEADER (cheap, no pixel decode)
// and reject anything past these caps before Jimp.read ever runs.
export const MAX_DIMENSION = 6000;            // px per side
export const MAX_PIXELS = 10 * 1000 * 1000;   // ~30MP total

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

// Read width/height straight from the format header — no pixel decode.
// Returns { width, height } or null if it can't be determined (we then let it
// through to Jimp, which has its own failure path).
function readDimensions(buf, mime) {
  try {
    if (mime === 'image/png') {
      // IHDR is the first chunk: width @16, height @20 (big-endian uint32).
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    if (mime === 'image/jpeg') {
      // Walk the marker segments looking for a Start-Of-Frame (SOFn).
      let off = 2; // skip SOI (0xFFD8)
      while (off + 9 < buf.length) {
        if (buf[off] !== 0xff) { off++; continue; }
        const marker = buf[off + 1];
        // SOF0..SOF15 carry the frame dimensions (excluding DHT/JPG/DAC).
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) };
        }
        // Standalone markers (no length): RSTn (D0-D7), SOI, EOI, TEM.
        if ((marker >= 0xd0 && marker <= 0xd9) || marker === 0x01) { off += 2; continue; }
        const segLen = buf.readUInt16BE(off + 2);
        if (segLen < 2) break;
        off += 2 + segLen;
      }
      return null;
    }
    if (mime === 'image/webp') {
      const fmt = buf.toString('ascii', 12, 16); // 'VP8 ' | 'VP8L' | 'VP8X'
      if (fmt === 'VP8 ') {
        return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
      }
      if (fmt === 'VP8L') {
        const b = buf.subarray(21, 25);
        return {
          width: ((b[1] & 0x3f) << 8 | b[0]) + 1,
          height: ((b[3] & 0x0f) << 10 | b[2] << 2 | (b[1] >> 6)) + 1,
        };
      }
      if (fmt === 'VP8X') {
        // 24-bit little-endian, stored as (dimension - 1).
        const width = (buf[24] | buf[25] << 8 | buf[26] << 16) + 1;
        const height = (buf[27] | buf[28] << 8 | buf[29] << 16) + 1;
        return { width, height };
      }
    }
  } catch {
    return null;
  }
  return null;
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
    // Decode the COMPRESSED bytes (not the pixels) — bounded by the size cap
    // above, so this allocation is safe and lets us read the header dimensions.
    buf = Buffer.from(base64, 'base64');
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

  // M5: reject oversized bitmaps from the header before any pixel decode.
  const dim = readDimensions(buf, match.mime);
  if (dim) {
    if (dim.width > MAX_DIMENSION || dim.height > MAX_DIMENSION ||
        dim.width * dim.height > MAX_PIXELS) {
      throw new Error(`Image dimensions are too large. Max ${MAX_DIMENSION}px per side.`);
    }
  }

  return { mime: match.mime, base64 };
}
