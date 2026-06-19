import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

// Resize a picked photo down to a max edge and re-encode as JPEG before upload.
// A raw phone photo is several MB of base64; capping the long edge at ~1024px
// typically cuts the payload 3–5×, which speeds up BOTH the upload and the
// Gemini vision call. Best-effort: returns { uri, base64 }, falling back to the
// original asset's bytes if manipulation fails for any reason.
export async function compressPhoto(asset, { maxDim = 1024, compress = 0.7 } = {}) {
  if (!asset?.uri) return asset;
  try {
    const ctx = ImageManipulator.manipulate(asset.uri);

    // Only ever downscale — never upscale a photo that's already small.
    const w = asset.width || 0;
    const h = asset.height || 0;
    if (Math.max(w, h) > maxDim) {
      ctx.resize(w >= h ? { width: maxDim } : { height: maxDim });
    }

    const ref = await ctx.renderAsync();
    const out = await ref.saveAsync({ compress, format: SaveFormat.JPEG, base64: true });
    return { uri: out.uri, base64: out.base64, width: out.width, height: out.height };
  } catch {
    // Manipulation failed (rare). The picker no longer hands us full-res base64
    // (that was an 8–16MB heap spike on every pick — see PalmStepScreen), so on
    // this cold path read the bytes from the file instead. Still best-effort:
    // if even that fails, fall through to whatever base64 the asset carried.
    try {
      const FileSystem = await import("expo-file-system/legacy");
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: "base64" });
      return { uri: asset.uri, base64, width: asset.width, height: asset.height };
    } catch {
      return { uri: asset.uri, base64: asset.base64, width: asset.width, height: asset.height };
    }
  }
}
