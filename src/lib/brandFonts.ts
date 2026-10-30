// Heading typefaces a brand pack can choose. Each is loaded once in the
// root layout without preloading, so the browser only downloads it when a
// page using that pack actually shows it. Safe for browser and server.

export const BRAND_HEADING_FONTS = [
  { key: "lexend", label: "Lexend", note: "Rounded and open, matching the Regenerate wordmark.", cssVar: "--font-lexend" },
  { key: "archivo", label: "Archivo Black", note: "Heavy and condensed, as on the Regenerate website headings.", cssVar: "--font-archivo" },
  { key: "barlow", label: "Barlow Condensed", note: "Tall and narrow, the closest free match to the DIN Condensed in Regenerate's presentations, with titles set in capitals.", cssVar: "--font-barlow", caps: true },
] as const;

export type BrandHeadingFont = (typeof BRAND_HEADING_FONTS)[number]["key"];

export function isBrandHeadingFont(value: unknown): value is BrandHeadingFont {
  return BRAND_HEADING_FONTS.some((f) => f.key === value);
}

// The CSS that swaps the app's heading typeface for the pack's own. The app
// writes every heading in var(--font-fraunces), so overriding that one
// variable on a page's root changes the headings beneath it.
export function headingFontStyle(font: string | null | undefined): Record<string, string> {
  const f = BRAND_HEADING_FONTS.find((x) => x.key === font);
  if (!f) return {};
  // Condensed faces are set in capitals, as in the brand's own materials.
  // Only titles, headings and names read --heading-case; body text does not.
  return {
    "--font-fraunces": `var(${f.cssVar}), "Inter", sans-serif`,
    ...("caps" in f && f.caps ? { "--heading-case": "uppercase" } : {}),
  };
}
