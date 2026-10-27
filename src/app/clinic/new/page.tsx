import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getBlockUsageTagCatalog } from "@/lib/blockUsageTags";
import NewProgrammeClient from "./NewProgrammeClient";

// Load live on each visit rather than at build time, so the exercise list is
// never stale and a database hiccup during a deploy can't fail the build.
export const dynamic = "force-dynamic";

export default async function NewBlockFromBriefPage() {
  const [{ data }, usageTagCatalog] = await Promise.all([
    supabaseAdmin
      .from("exercises")
      .select("exercise_id, name_clinical, body_site, thumbnail_url, default_prescription_mode")
      .eq("active", true)
      .order("exercise_id"),
    getBlockUsageTagCatalog(),
  ]);

  return <NewProgrammeClient exerciseLibrary={data ?? []} usageTagCatalog={usageTagCatalog} />;
}
