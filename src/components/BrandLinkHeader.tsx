import type { ResolvedBrandPack } from "@/lib/brandPackResolve";
import LoginHero from "@/app/start/LoginHero";
import { darkCanvasStyle } from "@/app/session/brandScopeStyle";

// The top of a page a client reaches from a pack's link before logging in
// (registration and the Programme intake form): the same logos as the
// pack's login page, so every link in a pack opens to the same look. A dark
// pack's light logos sit in a band of the pack's own dark canvas, unless the
// page beneath is already dark.
export default function BrandLinkHeader({ brand, pageIsDark = false }: { brand: ResolvedBrandPack; pageIsDark?: boolean }) {
  if (brand.theme !== "dark" || pageIsDark) {
    return (
      <div style={{ paddingBottom: 8 }}>
        <LoginHero brand={brand} />
      </div>
    );
  }
  return (
    <div style={{ ...darkCanvasStyle(brand), backgroundPosition: "center bottom", paddingBottom: 26 }}>
      <LoginHero brand={brand} />
    </div>
  );
}
