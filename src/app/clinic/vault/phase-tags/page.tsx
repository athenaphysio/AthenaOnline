import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ClinicBrandbar from "../../ClinicBrandbar";
import VaultTabs from "../VaultTabs";
import styles from "../VaultLibrary.module.css";
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
    <div className={styles.page}>
      <div className={styles.wrap}>
        <ClinicBrandbar />

        <div className={styles.topbar}>
          <div>
            <h1>Vault</h1>
            <div className={styles.sub}>Build and manage your reusable exercises, blocks, workouts, and programmes</div>
          </div>
        </div>

        <VaultTabs active="phase-tags" />

        <div className={styles.settingsPane}>
          <h3>Programme phases</h3>
          <div className={styles.sub}>
            Add, rename, or remove phase tags, used to mark which stage of the three stage arc an exercise or
            block belongs to.
          </div>
          <PhaseTagManagerClient phaseTags={rows} />
        </div>
      </div>
    </div>
  );
}
