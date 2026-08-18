import { supabaseAdmin } from "@/lib/supabaseAdmin";
import NewProgrammeClient from "./NewProgrammeClient";

export default async function NewBlockFromBriefPage() {
  const { data } = await supabaseAdmin
    .from("exercises")
    .select("exercise_id, name_clinical, body_site, thumbnail_url, default_prescription_mode")
    .eq("active", true)
    .order("exercise_id");

  return <NewProgrammeClient exerciseLibrary={data ?? []} />;
}
