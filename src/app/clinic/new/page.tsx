import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getBlockUsageTagCatalog } from "@/lib/blockUsageTags";
import NewProgrammeClient from "./NewProgrammeClient";

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
