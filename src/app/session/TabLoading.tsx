import type { CSSProperties } from "react";
import { cookies } from "next/headers";
import { LOADING_BRAND_COOKIE, decodeLoadingBrand } from "@/lib/loadingBrand";

// What shows for the moment it takes to open another tab of the client's
// app: just the client's own background, so the screen never flashes to
// another colour or to the full holding page on the way.
export default async function TabLoading() {
  const brand = decodeLoadingBrand((await cookies()).get(LOADING_BRAND_COOKIE)?.value);
  let style: CSSProperties = { minHeight: "100vh", background: "var(--cream)" };
  if (brand.theme === "dark") {
    const base = brand.canvas ?? "#250a0b";
    const accent = brand.accent ?? "#9b1c1c";
    const glow = (pct: number) => `color-mix(in srgb, ${accent} ${pct}%, transparent)`;
    style = {
      minHeight: "100vh",
      backgroundColor: base,
      backgroundImage: [
        `radial-gradient(120% 38% at 50% 0%, ${glow(38)} 0%, transparent 62%)`,
        `radial-gradient(90% 30% at 110% 42%, ${glow(20)} 0%, transparent 70%)`,
        `linear-gradient(180deg, color-mix(in srgb, ${base} 94%, white) 0%, ${base} 100%)`,
      ].join(", "),
      backgroundAttachment: "fixed",
    };
  }
  return <div style={style} role="status" aria-label="Loading" />;
}
