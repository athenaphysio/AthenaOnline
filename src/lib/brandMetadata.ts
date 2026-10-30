import "server-only";
import type { Metadata, Viewport } from "next";
import { resolveBrandPack, type ResolvedBrandPack } from "@/lib/brandPackResolve";
import { brandIconPath, brandManifestPath } from "@/lib/brandApp";
import { homeScreenName } from "@/lib/brandAppName";

// The browser tab for a page in a client's own brand pack: the pack's name in
// place of Athena Physio, and the pack's icon on the tab. With homeScreen,
// used only by the client's own app, it also sets the app a phone saves to
// its home screen: the pack's icon, the name under it, and the pack's own
// manifest for Android. A client on the standard Athena branding keeps the
// usual tab and app.
export function metadataForBrand(brand: ResolvedBrandPack | null, prefix?: string | null, homeScreen = false): Metadata {
  if (!brand || brand.isAllDefault) return {};
  const title = prefix ? `${prefix}, ${brand.name}` : brand.name;
  const v = brand.updated_at;
  const tabIcon = [{ url: brandIconPath(brand.id, 192, v), sizes: "192x192", type: "image/png" }];
  if (!homeScreen) return { title, icons: { icon: tabIcon } };
  const appName = homeScreenName(brand.name);
  return {
    title,
    applicationName: appName,
    appleWebApp: { capable: true, statusBarStyle: brand.theme === "dark" ? "black" : "default", title: appName },
    manifest: brandManifestPath(brand.id, v),
    icons: {
      icon: tabIcon,
      apple: [{ url: brandIconPath(brand.id, 180, v), sizes: "180x180", type: "image/png" }],
    },
  };
}

// The colour of the phone's status bar around the app, from the same pack.
export function viewportForBrand(brand: ResolvedBrandPack | null): Viewport {
  if (!brand || brand.isAllDefault) return {};
  return { themeColor: brand.background_color };
}

export async function viewportForClient(patientId: string | null | undefined): Promise<Viewport> {
  if (!patientId) return {};
  const brand = await resolveBrandPack({ patientId }).catch(() => null);
  return viewportForBrand(brand);
}

export async function metadataForClient(patientId: string | null | undefined, prefix?: string | null, homeScreen = false): Promise<Metadata> {
  if (!patientId) return {};
  const brand = await resolveBrandPack({ patientId }).catch(() => null);
  return metadataForBrand(brand, prefix, homeScreen);
}
