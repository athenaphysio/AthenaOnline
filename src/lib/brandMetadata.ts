import "server-only";
import type { Metadata } from "next";
import { resolveBrandPack, type ResolvedBrandPack } from "@/lib/brandPackResolve";

// The browser tab for a client on their own brand pack: the pack's name in
// place of Athena Physio, and the pack's mark as the tab icon. A client on
// the standard Athena branding keeps the usual tab.
export function metadataForBrand(brand: ResolvedBrandPack | null, prefix?: string | null): Metadata {
  if (!brand || brand.isAllDefault) return {};
  const title = prefix ? `${prefix}, ${brand.name}` : brand.name;
  const icon = brand.small_square_url || brand.logo_mark_url;
  return {
    title,
    appleWebApp: { capable: true, statusBarStyle: "default", title: brand.name },
    ...(icon ? { icons: { icon, apple: icon } } : {}),
  };
}

export async function metadataForClient(patientId: string | null | undefined, prefix?: string | null): Promise<Metadata> {
  if (!patientId) return {};
  const brand = await resolveBrandPack({ patientId }).catch(() => null);
  return metadataForBrand(brand, prefix);
}
