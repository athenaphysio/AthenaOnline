// The holding page (src/app/session/loading.tsx) shows before the landing
// page has looked anything up, so it can't resolve the client's brand pack
// itself. Instead the landing page leaves a small cookie describing how
// it last looked, and the holding page reads that back on the next visit.
// Pure helpers only, shared by both sides, so the cookie is written and
// read with the same rules.

export const LOADING_BRAND_COOKIE = "athena_loading_brand";

export type LoadingBrand = {
  theme: "light" | "dark";
  wordmarkUrl: string | null;
  textureUrl: string | null;
  accent: string | null;
  canvas: string | null;
  /** The name at the foot of the holding page: Dr David Silver PhD, the
   * pack's team, or nothing. Null keeps the usual Athena footer. */
  footer?: string | null;
};

const HEX = /^#[0-9a-fA-F]{6}$/;

// Only plain https image addresses and six digit hex colours survive, so
// nothing in the cookie can ever reach the page as anything else.
function safeUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 600) return null;
  if (!/^https:\/\/[^\s"'()<>\\]+$/.test(value)) return null;
  return value;
}

// Plain words only (letters, spaces and a few marks), so the footer can
// only ever be read as a name.
function safeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().slice(0, 60);
  return /^[\p{L}\p{N} .,'&-]*$/u.test(v) ? v : null;
}

function safeHex(value: unknown): string | null {
  return typeof value === "string" && HEX.test(value) ? value : null;
}

export function encodeLoadingBrand(brand: LoadingBrand): string {
  return encodeURIComponent(JSON.stringify(brand));
}

export function decodeLoadingBrand(raw: string | undefined | null): LoadingBrand {
  const fallback: LoadingBrand = { theme: "light", wordmarkUrl: null, textureUrl: null, accent: null, canvas: null, footer: null };
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>;
    if (parsed.theme !== "dark") return fallback;
    return {
      theme: "dark",
      wordmarkUrl: safeUrl(parsed.wordmarkUrl),
      textureUrl: safeUrl(parsed.textureUrl),
      accent: safeHex(parsed.accent),
      canvas: safeHex(parsed.canvas),
      footer: parsed.footer === undefined ? null : safeText(parsed.footer),
    };
  } catch {
    return fallback;
  }
}
