// A brand pack's full palette, for packs whose look goes beyond a single
// accent colour. Regenerate is the first: its Corporate Athlete material
// is deep navy with orange, bright blue and a handful of highlight
// colours, and the whole app follows it rather than the standard Athena
// cream and crimson. Safe to use in the browser and on the server.
//
// A pack without a palette is untouched: every function here returns
// nothing for it, so Athena and the other packs look exactly as before.

export type BrandPalette = {
  /** The page itself, a deep navy. */
  base: string;
  /** Cards and panels, a touch lighter than the base. */
  surface: string;
  /** Recessed areas inside a card: inputs, tracks. */
  recessed: string;
  /** Hairline borders around cards, as on the pack's chart panels. */
  line: string;
  /** Main text on the navy. */
  text: string;
  /** Secondary text. */
  textSoft: string;
  /** Labels and small print. */
  textMuted: string;
  /** The brand accent: titles, buttons, the open hexagon. */
  accent: string;
  /** Highlights, as used in the pack's charts and figures. */
  sky: string;
  blue: string;
  pink: string;
  green: string;
  coral: string;
  violet: string;
  /** Body typeface: "figtree" for the pack's rounded sans, or empty for Inter. */
  body: string;
};

const KEYS: (keyof BrandPalette)[] = [
  "base",
  "surface",
  "recessed",
  "line",
  "text",
  "textSoft",
  "textMuted",
  "accent",
  "sky",
  "blue",
  "pink",
  "green",
  "coral",
  "violet",
];

const HEX = /^#[0-9a-fA-F]{6}$/;

// Reads whatever the pack has stored. A palette is only used when every
// colour is present and valid, so a half-filled palette never leaves a
// screen with dark text on a dark page.
export function normalisePalette(raw: unknown): BrandPalette | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const out: Partial<BrandPalette> = {};
  for (const k of KEYS) {
    const v = r[k];
    if (typeof v !== "string" || !HEX.test(v.trim())) return null;
    out[k] = v.trim();
  }
  out.body = r.body === "figtree" ? "figtree" : "";
  return out as BrandPalette;
}

export function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function lift(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => Math.round(x + (255 - x) * amount));
  return `#${c.map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

// The canvas behind everything: the navy base, lifted by faint pools of
// the pack's blue rather than the accent, so it reads as deep blue and
// never as black or brown.
export function paletteCanvasLayers(p: BrandPalette): string[] {
  return [
    `radial-gradient(75% 38% at 88% 0%, ${rgba(p.blue, 0.24)} 0%, ${rgba(p.blue, 0)} 70%)`,
    `radial-gradient(60% 32% at -5% 55%, ${rgba(p.blue, 0.14)} 0%, ${rgba(p.blue, 0)} 70%)`,
    `radial-gradient(50% 22% at 50% 0%, ${rgba(p.accent, 0.1)} 0%, ${rgba(p.accent, 0)} 70%)`,
    `linear-gradient(180deg, ${lift(p.base, 0.03)} 0%, ${p.base} 100%)`,
  ];
}

// Colours shared by the client's app and the clinic: passport areas,
// result statuses and chart tones, all drawn from the pack's highlights.
function sharedVars(p: BrandPalette): Record<string, string> {
  return {
    "--crimson": p.accent,
    "--crimson-dark": lift(p.accent, 0.22),
    "--crimson-light": rgba(p.accent, 0.14),
    "--amber": lift(p.accent, 0.22),
    "--dark-canvas": p.base,
    "--on-canvas": p.text,
    "--on-canvas-soft": p.textSoft,
    "--on-canvas-accent": p.accent,
    "--on-canvas-muted": p.textMuted,
    "--domain-heart_recovery": p.coral,
    "--domain-sleep_energy": p.sky,
    "--domain-blood": p.pink,
    "--domain-gut": p.green,
    "--domain-body_movement": p.accent,
    "--domain-mind_behaviour": lift(p.violet, 0.45),
    "--status-optimal": p.green,
    "--status-optimal-soft": rgba(p.green, 0.16),
    "--status-in_range": p.sky,
    "--status-in_range-soft": rgba(p.sky, 0.16),
    "--status-worth_a_conversation": p.accent,
    "--status-worth_a_conversation-soft": rgba(p.accent, 0.16),
    "--status-no_range": p.textSoft,
    "--status-no_range-soft": rgba(p.textSoft, 0.12),
    "--chart-range": rgba(p.sky, 0.18),
    "--chart-optimal": rgba(p.green, 0.24),
    "--chart-track": rgba(p.text, 0.08),
    "--chart-grid": rgba(p.blue, 0.35),
    "--chart-axis": p.textMuted,
    "--chart-ink": p.text,
    "--chart-ghost": p.surface,
    "--palette-line": rgba(p.blue, 0.7),
    "--palette-line-soft": rgba(p.blue, 0.4),
    "--card-bg": p.surface,
    "--input-bg": p.recessed,
    "--hex-accent": p.accent,
    "--hex-line": p.text,
    "--hex-outer": rgba(p.textSoft, 0.45),
    "--hex-fill": p.surface,
    "--hex-trace": p.coral,
    "--hex-trace-alt": p.sky,
    ...(p.body === "figtree" ? { "--font-inter": 'var(--font-figtree), "Inter", sans-serif' } : {}),
  };
}

// The client's app: navy cards with a fine blue line instead of the
// standard cream ones, with light text throughout.
export function paletteClientVars(p: BrandPalette): Record<string, string> {
  return {
    ...sharedVars(p),
    "--surface": p.surface,
    "--charcoal": p.text,
    "--stone": p.textSoft,
    "--muted": p.textMuted,
    "--border": rgba(p.blue, 0.6),
    "--sand": p.recessed,
    "--parchment": rgba(p.blue, 0.45),
    // Cream is a background in places (tags, hovers), so it becomes a deep
    // navy; the banner's light ink (title, bell, menu) has its own colour.
    "--cream": p.recessed,
    "--ink": p.text,
    "--graphite": p.textSoft,
    "--mist": rgba(p.blue, 0.5),
    "--banner-ink": p.text,
    "--quicklink-bg": p.surface,
    "--quicklink-hover": p.recessed,
    "--banner-wash": `linear-gradient(135deg, ${rgba(p.blue, 0.3)} 0%, ${rgba(p.base, 0.35)} 100%)`,
    "--banner-line": rgba(p.blue, 0.7),
  };
}

// The clinic's view of the client: the dark dashboard cards and the cream
// working boxes both become navy panels, so the care team sees the same
// look as the client and the marketing material.
export function paletteClinicVars(p: BrandPalette): Record<string, string> {
  return {
    ...sharedVars(p),
    // The clinic's client dashboard: dark page, light text.
    "--charcoal": p.base,
    "--charcoal-2": p.surface,
    "--cream": p.text,
    "--parchment": p.textSoft,
    "--sand": p.textSoft,
    "--wash": rgbTriplet(p.blue),
    // The fine blue edge of the pack's own panels.
    "--border": rgba(p.blue, 0.55),
    "--border-strong": rgba(p.blue, 0.8),
    // The clinic's working boxes.
    "--clinic-box": p.surface,
    "--clinic-box-recessed": p.recessed,
    "--ink": p.text,
    "--graphite": p.textSoft,
    "--mist": rgba(p.blue, 0.5),
    "--frost": p.recessed,
    "--clinic-on-canvas": p.text,
    "--clinic-on-canvas-muted": p.textSoft,
  };
}

function rgbTriplet(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/** Regenerate's palette, taken from the Corporate Athlete Executive Programme pack (October 2026). */
export const REGENERATE_PALETTE: BrandPalette = {
  base: "#0c1a2f",
  surface: "#10223b",
  recessed: "#0a1628",
  line: "#3871c1",
  text: "#f4f7fb",
  textSoft: "#c3cfde",
  textMuted: "#8ea4c2",
  accent: "#ec9025",
  sky: "#68bceb",
  blue: "#3871c1",
  pink: "#d589ca",
  green: "#9ac454",
  coral: "#f25655",
  violet: "#483f66",
  body: "figtree",
};
