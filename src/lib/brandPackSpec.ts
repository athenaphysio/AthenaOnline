// The six components every brand pack can carry, in the fixed order the
// spec document lays them out in. Pure data only (no server-only import),
// so the upload UI can read the same numbers it validates against --
// one source of truth for "what David is told to aim for" and "what the
// warning check compares against".
export type BrandPackComponentKey =
  | "logo_mark"
  | "wordmark"
  | "cover_square"
  | "wide_banner"
  | "small_square"
  | "background_texture";

export type BrandPackComponentSpec = {
  key: BrandPackComponentKey;
  urlField:
    | "logo_mark_url"
    | "wordmark_url"
    | "cover_square_url"
    | "wide_banner_url"
    | "small_square_url"
    | "background_texture_url";
  label: string;
  width: number;
  height: number;
  /** Human-readable format line shown above the upload box. */
  formatLabel: string;
  /** True transparency is the one thing the spec calls out as commonly
   * faked (a flat JPG saved with a .png name) -- checked for real on
   * upload for these two components only. */
  requiresTransparency: boolean;
  /** Background pattern/texture is the one optional component -- the
   * pack just falls back to a flat colour background without it. */
  optional: boolean;
  what: string;
  usedFor: string;
};

export const BRAND_PACK_COMPONENTS: BrandPackComponentSpec[] = [
  {
    key: "logo_mark",
    urlField: "logo_mark_url",
    label: "Logo mark",
    width: 1092,
    height: 1092,
    formatLabel: "1092 × 1092px, transparent PNG",
    requiresTransparency: true,
    optional: false,
    what: "Just the symbol, no name text.",
    usedFor: "App icon badges, small avatars, watermarks over video.",
  },
  {
    key: "wordmark",
    urlField: "wordmark_url",
    label: "Wordmark lockup",
    width: 1568,
    height: 504,
    formatLabel: "1568 × 504px, transparent PNG",
    requiresTransparency: true,
    optional: false,
    what: "The full name lockup, symbol + text together, horizontal.",
    usedFor: "Page headers, nav bars, email headers, video end-cards.",
  },
  {
    key: "cover_square",
    urlField: "cover_square_url",
    label: "Cover square",
    width: 1092,
    height: 1092,
    formatLabel: "1092 × 1092px, JPG",
    requiresTransparency: false,
    optional: false,
    what: "The finished branded card -- background, logo, name, all baked in.",
    usedFor: "Programme cover art, share cards, the thumbnail a client sees when picking a programme.",
  },
  {
    key: "wide_banner",
    urlField: "wide_banner_url",
    label: "Wide banner",
    width: 1568,
    height: 588,
    formatLabel: "1568 × 588px, JPG or PNG",
    requiresTransparency: false,
    optional: false,
    what: "A wide version of the background art or texture.",
    usedFor: "Top-of-page banners, email headers where a square doesn't fit.",
  },
  {
    key: "small_square",
    urlField: "small_square_url",
    label: "Small square",
    width: 512,
    height: 512,
    formatLabel: "512 × 512px, JPG or transparent PNG",
    requiresTransparency: false,
    optional: false,
    what: "A simplified, small-scale version.",
    usedFor: "Chat avatars, small category badges, list thumbnails.",
  },
  {
    key: "background_texture",
    urlField: "background_texture_url",
    label: "Background pattern / texture",
    width: 1568,
    height: 588,
    formatLabel: "1568 × 588px minimum, JPG or PNG (optional)",
    requiresTransparency: false,
    optional: true,
    what: "A reusable graphic motif, not a finished card. Skip it and the pack just uses a flat colour background instead.",
    usedFor: "Recoloured/reused across the square cover, wide banner, and section backgrounds.",
  },
];

export function brandPackComponentSpec(key: BrandPackComponentKey): BrandPackComponentSpec {
  const spec = BRAND_PACK_COMPONENTS.find((c) => c.key === key);
  if (!spec) throw new Error(`Unknown brand pack component: ${key}`);
  return spec;
}

// Pure size/shape check, no image decoding library needed -- shared
// between the upload box's immediate client-side feedback (the moment a
// file is picked, from the browser's own Image() dimensions) and the
// server-side re-check on the actual upload. A nudge, not a gate: this
// only ever returns text to show under the box, never blocks anything.
export function warningForDimensions(
  spec: BrandPackComponentSpec,
  width: number,
  height: number
): string | null {
  const widthRatio = width / spec.width;
  const heightRatio = height / spec.height;
  const widthOff = widthRatio < 0.8 || widthRatio > 1.2;
  const heightOff = heightRatio < 0.8 || heightRatio > 1.2;

  const specAspect = spec.width / spec.height;
  const actualAspect = width / height;
  const aspectOff = actualAspect / specAspect < 0.8 || actualAspect / specAspect > 1.2;

  if (spec.optional && (width < spec.width || height < spec.height)) {
    return `This is smaller than the ${spec.width} × ${spec.height}px minimum -- the app can crop it, but check it still looks right cropped.`;
  }
  if (aspectOff) {
    const specShape = specAspect > 1.3 ? "wide" : specAspect < 0.77 ? "tall" : "square";
    return specShape === "square"
      ? "This looks like it might not be square -- check before saving."
      : `This looks like it might not be the right shape (expected roughly ${specShape}) -- check before saving.`;
  }
  if (widthOff || heightOff) {
    return `This is ${width} × ${height}px, some way off the ${spec.width} × ${spec.height}px spec -- check before saving.`;
  }
  return null;
}
