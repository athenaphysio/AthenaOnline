import type { CSSProperties } from "react";
import type { ResolvedBrandPack } from "@/lib/brandPackResolve";
import { darkCanvasStyle } from "@/app/session/brandScopeStyle";

// The clinician's view of a client wears that client's own branding, built
// from the same brand pack and the same rules as the client's app, so the
// clinician sees what the client sees. A client on the standard Athena
// branding keeps the usual clinic look.
export function clinicianBrandStyle(brand: ResolvedBrandPack | null): {
  style: CSSProperties | undefined;
  wordmarkUrl: string | null;
  logoUrl: string | null;
} {
  if (!brand || brand.isAllDefault) return { style: undefined, wordmarkUrl: null, logoUrl: null };

  if (brand.theme === "dark") {
    // Exactly the canvas the client's home screen uses for a dark pack.
    return {
      style: {
        ...darkCanvasStyle(brand),
        "--clinic-on-canvas": "#ffffff",
        "--clinic-on-canvas-muted": "rgba(255, 255, 255, 0.72)",
      } as CSSProperties,
      wordmarkUrl: brand.wordmark_reversed_url ?? brand.wordmark_url,
      logoUrl: brand.logo_mark_url,
    };
  }

  // Otherwise the pack's own background and accent. Text colour follows how
  // dark the background really is, since a pack set to "light" can still
  // have a dark background (Atomic SpeedWorks is black).
  const darkBackground = luminance(brand.background_color) < 0.35;
  const style: Record<string, string> = {
    "--crimson": brand.accent_color,
    "--cream": brand.background_color,
    "--clinic-on-canvas": darkBackground ? "#ffffff" : "#1c1c1c",
    "--clinic-on-canvas-muted": darkBackground ? "rgba(255, 255, 255, 0.72)" : "#5f5750",
    backgroundColor: brand.background_color,
    backgroundImage: brand.background_texture_url ? `url("${brand.background_texture_url}")` : "none",
  };
  return {
    style: style as CSSProperties,
    wordmarkUrl: darkBackground ? brand.wordmark_reversed_url ?? brand.wordmark_url : brand.wordmark_url,
    logoUrl: brand.logo_mark_url,
  };
}

// Perceived brightness from 0 (black) to 1 (white).
export function luminance(hex: string): number {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return 1;
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// The same idea for Dr David Silver PhD's own client dashboard in the
// clinic, which is a dark page by design. A brand with a dark background
// keeps the dark cards on the client's own canvas and accent. A brand with
// a light background switches the page to its light version (see
// .pageLight in ClientDashboard.module.css), so text stays readable.
export function dashboardBrand(brand: ResolvedBrandPack | null): {
  style: CSSProperties | undefined;
  light: boolean;
  wordmarkUrl: string | null;
  logoUrl: string | null;
} {
  if (!brand || brand.isAllDefault) return { style: undefined, light: false, wordmarkUrl: null, logoUrl: null };

  const accent = brand.accent_color;
  const darkBackground = brand.theme === "dark" || luminance(brand.background_color) < 0.35;

  if (darkBackground) {
    return {
      style: {
        ...darkCanvasStyle(brand),
        "--crimson": accent,
        "--clinic-on-canvas-muted": "rgba(255, 255, 255, 0.72)",
      } as CSSProperties,
      light: false,
      wordmarkUrl: brand.wordmark_reversed_url ?? brand.wordmark_url,
      logoUrl: brand.logo_mark_url,
    };
  }

  const style: Record<string, string> = {
    "--crimson": accent,
    "--clinic-on-canvas-muted": "#5f5750",
    backgroundColor: brand.background_color,
    backgroundImage: brand.background_texture_url ? `url("${brand.background_texture_url}")` : "none",
    backgroundRepeat: "repeat-x",
    backgroundPosition: "left bottom",
    backgroundAttachment: "fixed",
    backgroundSize: "auto 340px",
  };
  return { style: style as CSSProperties, light: true, wordmarkUrl: brand.wordmark_url, logoUrl: brand.logo_mark_url };
}
