// M5 — decompression-bomb / dimension guard in validateImage.

import { describe, it, expect } from 'vitest';
import { validateImage, MAX_DIMENSION } from '../src/utils/imageValidator.js';

// Build a minimal valid PNG header declaring width×height in the IHDR chunk.
// Only the header matters — validateImage reads dimensions without decoding pixels.
function pngWithDims(width, height) {
  const buf = Buffer.alloc(33);
  // PNG signature
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8);            // IHDR length
  buf.write('IHDR', 12, 'ascii');      // chunk type
  buf.writeUInt32BE(width, 16);        // width
  buf.writeUInt32BE(height, 20);       // height
  buf[24] = 8;                         // bit depth
  buf[25] = 6;                         // color type (RGBA)
  return `data:image/png;base64,${buf.toString('base64')}`;
}

describe('validateImage dimension guard', () => {
  it('accepts a normal-sized PNG', () => {
    const out = validateImage(pngWithDims(1200, 1600));
    expect(out.mime).toBe('image/png');
  });

  it('rejects a PNG whose declared side exceeds MAX_DIMENSION (a decompression bomb)', () => {
    expect(() => validateImage(pngWithDims(MAX_DIMENSION + 1, 100))).toThrow(/dimensions are too large/i);
  });

  it('rejects a PNG whose total pixel count is enormous', () => {
    expect(() => validateImage(pngWithDims(MAX_DIMENSION, MAX_DIMENSION))).toThrow(/dimensions are too large/i);
  });
});
