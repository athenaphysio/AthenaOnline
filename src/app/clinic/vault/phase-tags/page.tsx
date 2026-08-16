import { supabaseAdmin } from "@/lib/supabaseAdmin";
import clinicStyles from "../../clinic.module.css";
import ClinicBrandbar from "../../ClinicBrandbar";
import PhaseTagManagerClient, { type PhaseTagRow } from "./PhaseTagManagerClient";

export const dynamic = "force-dynamic";

export default async function VaultPhaseTagsPage() {
  const [{ data: phaseTags, error }, { data: exerciseTags }, { data: blockTags }] = await Promise.all([
    supabaseAdmin.from("phase_tags").select("id, name").order("name").returns<{ id: string; name: string }[]>(),
    supabaseAdmin.from("exercises").select("phase_id").not("phase_id", "is", null).returns<{ phase_id: string }[]>(),
    supabaseAdmin.from("blocks").select("phase_id").not("phase_id", "is", null).returns<{ phase_id: string }[]>(),
  ]);

  if (error) {
    throw new Error(`Phase tag list query failed: ${error.message}`);
  }

  const usageCounts = new Map<string, number>();
  for (const t of exerciseTags ?? []) usageCounts.set(t.phase_id, (usageCounts.get(t.phase_id) ?? 0) + 1);
  for (const t of blockTags ?? []) usageCounts.set(t.phase_id, (usageCounts.get(t.phase_id) ?? 0) + 1);

  const rows: PhaseTagRow[] = (phaseTags ?? []).map((p) => ({ ...p, usageCount: usageCounts.get(p.id) ?? 0 }));

  return (
    <div className={clinicStyles.app}>
      <div className={clinicStyles.inner}>
        <ClinicBrandbar />

        <h1 className={clinicStyles.heading}>Programme phases</h1>
        <p className={clinicStyles.subheading}>
          Add, rename, or remove phase tags, used to mark which stage of the three stage arc an exercise or
          block belongs to.
        </p>

        <PhaseTagManagerClient phaseTags={rows} />
      </div>
    </div>
  );
}
