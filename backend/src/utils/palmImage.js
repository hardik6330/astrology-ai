import Jimp from 'jimp';

// Lightly normalize a palm photo before it goes to Gemini Vision: stretch the
// histogram (fixes dull / under-exposed shots) and add a gentle contrast bump so
// the major creases read more clearly — WITHOUT the heavy edge-detection that
// would strip the natural skin/mount detail a vision model relies on. Pure JS
// (Jimp) so it runs in the Vercel serverless function — no native/OpenCV deps.
//
// Best-effort: on any failure it returns the original base64 unchanged, so a
// processing hiccup never blocks a reading.
export async function enhancePalmImage(base64) {
  try {
    const img = await Jimp.read(Buffer.from(base64, 'base64'));
    img.normalize();      // per-channel histogram stretch → even out lighting
    img.contrast(0.08);   // mild global contrast → creases pop without crushing tone
    const out = await img.getBufferAsync(Jimp.MIME_JPEG);
    return { base64: out.toString('base64'), mimeType: 'image/jpeg', enhanced: true };
  } catch {
    return { base64, mimeType: 'image/jpeg', enhanced: false };
  }
}
