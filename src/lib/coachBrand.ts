import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolvePackById, type ResolvedBrandPack } from "@/lib/brandPackResolve";

// The brand a clinician's own pages wear. A clinician who works within a
// single branded package (for example everyone on the Regenerate team)
// sees that package's brand throughout; anyone else sees the clinic's own.
export async function coachBrandFor(staffId: string): Promise<ResolvedBrandPack | null> {
  const { data } = await supabaseAdmin
    .from("staff_package_sections")
    .select("packages(brand_pack_id)")
    .eq("staff_id", staffId)
    .returns<{ packages: { brand_pack_id: string | null } | null }[]>();
  const ids = new Set((data ?? []).map((r) => r.packages?.brand_pack_id ?? null));
  if (ids.size !== 1) return null;
  const [only] = Array.from(ids);
  return only ? resolvePackById(only) : null;
}
