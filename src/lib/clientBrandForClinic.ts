import "server-only";
import type { CSSProperties } from "react";
import { resolveBrandPack } from "@/lib/brandPackResolve";
import { dashboardBrand } from "@/lib/clinicianBrandStyle";

// For clinic pages that belong to one client but sit outside their record,
// such as building or editing that client's programme: the page wears the
// client's own brand pack, as their record does. Light packs keep the
// usual clinic page, since these pages are built for a dark canvas.
export async function clientBrandForClinic(patientId: string | null | undefined): Promise<{
  style: CSSProperties | undefined;
  logoUrl: string | null;
  wordmarkUrl: string | null;
  /** For the sidebar's first frame (see ClinicBrandbar). */
  accent: string | null;
  canvas: string | null;
}> {
  const none = { style: undefined, logoUrl: null, wordmarkUrl: null, accent: null, canvas: null };
  if (!patientId) return none;
  const brand = await resolveBrandPack({ patientId }).catch(() => null);
  const branded = dashboardBrand(brand);
  if (!brand || !branded.style || branded.light) return none;
  return {
    style: branded.style,
    logoUrl: branded.logoUrl,
    wordmarkUrl: branded.wordmarkUrl,
    accent: brand.app_layout.palette?.accent ?? brand.accent_color,
    canvas: brand.app_layout.palette?.base ?? brand.background_color,
  };
}
