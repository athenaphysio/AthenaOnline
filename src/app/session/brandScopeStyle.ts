import type { CSSProperties } from "react";
import type { ResolvedBrandPack } from "@/lib/brandPackResolve";
import { headingFontStyle } from "@/lib/brandFonts";

// Shared by every screen under /session that renders its own .app root
// (TodaySession, OpenRoutine, RestDayScreen) -- scoped CSS custom property
// override, skipped entirely when resolution landed on the default pack
// so the common case has zero inline style and zero risk of drifting from
// today's exact colours.
export function brandScopeStyle(brand?: ResolvedBrandPack): CSSProperties | undefined {
  if (!brand || brand.isAllDefault) return undefined;
  // A dark pack's background colour is the deep canvas used on the
  // landing page and the holding page (see darkCanvasStyle). Every other
  // screen keeps its light page, so only the accent carries across.
  const font = headingFontStyle(brand.heading_font);
  if (brand.theme === "dark") return { "--crimson": brand.accent_color, ...font } as CSSProperties;
  return { "--crimson": brand.accent_color, "--cream": brand.background_color, ...font } as CSSProperties;
}

// The toned canvas for a dark pack: a deep base from the pack's background
// colour, lifted by soft pools of the accent so it never reads as one flat
// block, with the pack's texture fixed along the bottom of the screen the
// same way the clinic side carries its mountain ridge.
export function darkCanvasStyle(brand: ResolvedBrandPack): CSSProperties {
  const base = brand.background_color;
  const accent = brand.accent_color;
  const layers = [
    `radial-gradient(120% 38% at 50% 0%, ${hexToRgba(accent, 0.38)} 0%, ${hexToRgba(accent, 0)} 62%)`,
    `radial-gradient(90% 30% at 110% 42%, ${hexToRgba(accent, 0.2)} 0%, ${hexToRgba(accent, 0)} 70%)`,
    `radial-gradient(80% 30% at -15% 72%, ${hexToRgba(accent, 0.18)} 0%, ${hexToRgba(accent, 0)} 70%)`,
    `linear-gradient(180deg, ${lightenHex(base, 0.06)} 0%, ${base} 100%)`,
  ];
  const style: Record<string, string> = {
    "--crimson": accent,
    "--dark-canvas": base,
    // Light text tints on the dark canvas (the client's name, small
    // headings) are drawn from the pack's own accent, lifted so they stay
    // readable: a deep accent is lifted further than a bright one.
    "--on-canvas-accent": lightenHex(accent, accentLift(accent)),
    "--on-canvas-muted": lightenHex(accent, Math.min(0.75, accentLift(accent) + 0.12)),
    backgroundColor: base,
    ...headingFontStyle(brand.heading_font),
  };
  if (brand.background_texture_url) {
    style.backgroundImage = [`url("${brand.background_texture_url}")`, ...layers].join(", ");
    style.backgroundRepeat = ["repeat-x", ...layers.map(() => "no-repeat")].join(", ");
    style.backgroundPosition = ["left bottom", ...layers.map(() => "center")].join(", ");
    style.backgroundSize = ["auto 340px", ...layers.map(() => "100% 100%")].join(", ");
    style.backgroundAttachment = ["fixed", ...layers.map(() => "fixed")].join(", ");
  } else {
    style.backgroundImage = layers.join(", ");
    style.backgroundAttachment = "fixed";
  }
  return style as CSSProperties;
}

function accentLift(hex: string): number {
  const [r, g, b] = parseHex(hex);
  const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return brightness < 0.3 ? 0.55 : 0.28;
}

function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function lightenHex(hex: string, amount: number): string {
  const [r, g, b] = parseHex(hex).map((c) => Math.round(c + (255 - c) * amount));
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function parseHex(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return [37, 10, 11];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
