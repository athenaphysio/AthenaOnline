import "server-only";
import { cookies } from "next/headers";
import { resolvePackById, type ResolvedBrandPack } from "@/lib/brandPackResolve";
import { isPackId } from "@/lib/brandApp";
import { BRAND_PACK_COOKIE } from "@/lib/brandPackCookie";

// The brand for a page shown before the client has logged in: the one named
// in the link (an invite email or join link), otherwise the one this phone
// remembers, otherwise none, which keeps the standard Athena look.
export async function loginPageBrand(brandParam?: string | string[] | null): Promise<ResolvedBrandPack | null> {
  const fromLink = typeof brandParam === "string" && isPackId(brandParam) ? brandParam : null;
  const remembered = (await cookies()).get(BRAND_PACK_COOKIE)?.value ?? null;
  const id = fromLink ?? (remembered && isPackId(remembered) ? remembered : null);
  if (!id) return null;
  const brand = await resolvePackById(id).catch(() => null);
  return brand && !brand.isAllDefault ? brand : null;
}

// A brand's join link name: its pack name in lower case with hyphens, so
// "Regenerate Wellness" is /join/regenerate-wellness. Its first word on its
// own (/join/regenerate) works too.
export function packSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
