import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

// Crop the palm ROI from the ORIGINAL (full-res) photo using the gate's 21
// landmarks, then downscale the crop for upload. Cropping from full-res BEFORE
// the downscale means the hand fills the frame at far higher effective
// resolution than uploading the whole shrunk photo — so Gemini sees the creases
// instead of a small palm lost in background.
//
// We crop the FULL-HAND bounding box (not palm-only): the fingers carry mounts,
// marriage lines and finger-length cues the reading uses, so keep them. 20%
// padding keeps the edges (Venus/Luna mounts, finger bases) in frame.
//
// landmarks are in the gate's detection space (gateW × gateH); we scale the box
// up to the original asset's pixels. Best-effort: returns null on any failure so
// the caller falls back to a plain compress.
export async function cropPalmRegion(
  asset,
  landmarks,
  gateW,
  gateH,
  { maxDim = 1024, compress = 0.72, pad = 0.2 } = {},
) {
  try {
    if (!asset?.uri || !Array.isArray(landmarks) || landmarks.length < 21) return null;
    const ow = asset.width, oh = asset.height;
    if (!ow || !oh || !gateW || !gateH) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of landmarks) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const bw = maxX - minX, bh = maxY - minY;
    if (bw <= 0 || bh <= 0) return null;

    // Pad in gate space, clamp, then scale to original pixels.
    const sx = ow / gateW, sy = oh / gateH;
    const x0 = Math.round(Math.max(0, minX - bw * pad) * sx);
    const y0 = Math.round(Math.max(0, minY - bh * pad) * sy);
    const x1 = Math.round(Math.min(gateW, maxX + bw * pad) * sx);
    const y1 = Math.round(Math.min(gateH, maxY + bh * pad) * sy);
    const cw = Math.min(ow - x0, x1 - x0);
    const ch = Math.min(oh - y0, y1 - y0);
    if (cw < 10 || ch < 10) return null;

    const ctx = ImageManipulator.manipulate(asset.uri);
    ctx.crop({ originX: x0, originY: y0, width: cw, height: ch });
    if (Math.max(cw, ch) > maxDim) ctx.resize(cw >= ch ? { width: maxDim } : { height: maxDim });
    const ref = await ctx.renderAsync();
    const out = await ref.saveAsync({ compress, format: SaveFormat.JPEG, base64: true });
    return { uri: out.uri, base64: out.base64, width: out.width, height: out.height };
  } catch {
    return null;
  }
}
