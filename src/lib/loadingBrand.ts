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
};

const HEX = /^#[0-9a-fA-F]{6}$/;

// Only plain https image addresses and six digit hex colours survive, so
// nothing in the cookie can ever reach the page as anything else.
function safeUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 600) return null;
  if (!/^https:\/\/[^\s"'()<>\\]+$/.test(value)) return null;
  return value;
}

function safeHex(value: unknown): string | null {
  return typeof value === "string" && HEX.test(value) ? value : null;
}

export function encodeLoadingBrand(brand: LoadingBrand): string {
  return encodeURIComponent(JSON.stringify(brand));
}

export function decodeLoadingBrand(raw: string | undefined | null): LoadingBrand {
  const fallback: LoadingBrand = { theme: "light", wordmarkUrl: null, textureUrl: null, accent: null, canvas: null };
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
    };
  } catch {
    return fallback;
  }
}
