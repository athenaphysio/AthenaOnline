import type { CSSProperties } from "react";
import type { ResolvedBrandPack } from "@/lib/brandPackResolve";
import { brandScopeStyle, darkCanvasStyle } from "@/app/session/brandScopeStyle";

// The outer look of the login and set password pages. A dark pack gets the
// same deep canvas as the client's own home screen, in place of the cream
// page with its mountain ridge; a light pack keeps the cream page in its own
// accent; no pack keeps the standard Athena page.
export function loginRootProps(
  brand: ResolvedBrandPack | null,
  styles: Readonly<Record<string, string>>,
): { className: string; style: CSSProperties | undefined } {
  if (brand && !brand.isAllDefault && brand.theme === "dark") {
    return { className: `${styles.app} ${styles.appDark}`, style: darkCanvasStyle(brand) };
  }
  return { className: styles.app, style: brandScopeStyle(brand ?? undefined) };
}
