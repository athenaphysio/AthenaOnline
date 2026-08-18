import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ClinicBrandbar from "../../ClinicBrandbar";
import VaultTabs from "../VaultTabs";
import VaultBlocksClient from "./VaultBlocksClient";
import { getVaultBlockCards } from "@/lib/vaultBlocksLibraryServer";
import type { LibraryExerciseOption } from "@/lib/blockItemsEditor";
import styles from "../VaultLibrary.module.css";

// Same reasoning as the Exercises tab -- no dynamic API of its own, so
// without this the library would freeze at whatever blocks looked like at
// build time.
export const dynamic = "force-dynamic";

export default async function VaultBlocksPage() {
  const [blocks, exerciseLibraryRes] = await Promise.all([
    getVaultBlockCards(),
    supabaseAdmin
      .from("exercises")
      .select("exercise_id, name_clinical, body_site, thumbnail_url")
      .eq("active", true)
      .order("exercise_id")
      .returns<LibraryExerciseOption[]>(),
  ]);

  if (exerciseLibraryRes.error) {
    throw new Error(`Vault blocks library query failed: ${exerciseLibraryRes.error.message}`);
  }

  return (
    <div className={styles.page}>
      <div className={styles.wrapWide}>
        <ClinicBrandbar />

        <div className={styles.topbar}>
          <div>
            <h1>Vault</h1>
            <div className={styles.sub}>Build and manage your reusable exercises, blocks, workouts, and programmes</div>
          </div>
        </div>

        <VaultTabs active="blocks" />

        <VaultBlocksClient blocks={blocks} exerciseLibrary={exerciseLibraryRes.data ?? []} />
      </div>
    </div>
  );
}
