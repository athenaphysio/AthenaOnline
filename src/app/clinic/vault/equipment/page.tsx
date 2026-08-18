import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ClinicBrandbar from "../../ClinicBrandbar";
import VaultTabs from "../VaultTabs";
import styles from "../VaultLibrary.module.css";
import EquipmentManagerClient, { type EquipmentRow } from "./EquipmentManagerClient";

// Same reasoning as the other Vault pages -- no dynamic API of its own, so
// without this the list would freeze at whatever equipment looked like at
// build time.
export const dynamic = "force-dynamic";

export default async function VaultEquipmentPage() {
  const [{ data: equipment, error }, { data: tags }] = await Promise.all([
    supabaseAdmin.from("equipment").select("id, name, icon_url").order("name").returns<{ id: string; name: string; icon_url: string | null }[]>(),
    supabaseAdmin.from("exercise_equipment").select("equipment_id").returns<{ equipment_id: string }[]>(),
  ]);

  if (error) {
    throw new Error(`Equipment list query failed: ${error.message}`);
  }

  const usageCounts = new Map<string, number>();
  for (const t of tags ?? []) {
    usageCounts.set(t.equipment_id, (usageCounts.get(t.equipment_id) ?? 0) + 1);
  }

  const rows: EquipmentRow[] = (equipment ?? []).map((e) => ({ ...e, usageCount: usageCounts.get(e.id) ?? 0 }));

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

        <VaultTabs active="equipment" />

        <div className={styles.settingsPane}>
          <h3>Equipment</h3>
          <div className={styles.sub}>
            Add, rename, or remove equipment items and their icons, used to tag exercises across Vault.
          </div>
          <EquipmentManagerClient equipment={rows} />
        </div>
      </div>
    </div>
  );
}
