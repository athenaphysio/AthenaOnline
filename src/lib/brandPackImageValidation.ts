import "server-only";
import sharp from "sharp";
import { brandPackComponentSpec, warningForDimensions, type BrandPackComponentKey } from "@/lib/brandPackSpec";

// Re-checked server-side on the actual upload (defence in depth -- the
// editor already showed a client-side warning the moment the file was
// picked, from the browser's own Image() dimensions). A nudge, never a
// gate: this only ever returns a warning string, never blocks the upload.
export async function validateBrandPackImage(
  componentKey: BrandPackComponentKey,
  buffer: Buffer
): Promise<string | null> {
  const spec = brandPackComponentSpec(componentKey);
  const meta = await sharp(buffer).metadata();
  const { width, height } = meta;
  if (!width || !height) return null;

  const dimensionWarning = warningForDimensions(spec, width, height);
  if (dimensionWarning) return dimensionWarning;

  // The spec's own documented pitfall: a "transparent" PNG that's
  // actually a flat, fully-opaque image saved with a .png filename.
  if (spec.requiresTransparency) {
    if (meta.format !== "png") {
      return "This needs to be a transparent PNG -- this file looks like it was saved as a different format.";
    }
    if (!meta.hasAlpha) {
      return "This PNG doesn't have any transparency in it (it'll show a solid box instead of overlaying cleanly) -- check before saving.";
    }
    // hasAlpha can be true even when every pixel is fully opaque (some
    // exporters always add a channel). Sample the actual alpha data to
    // catch that case for real, not just "a channel exists".
    const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let sawTransparency = false;
    for (let i = 3; i < data.length; i += info.channels) {
      if (data[i] < 255) {
        sawTransparency = true;
        break;
      }
    }
    if (!sawTransparency) {
      return "This PNG doesn't look like it has real transparency (every pixel is fully opaque) -- check before saving.";
    }
  }

  return null;
}
