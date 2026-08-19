import VaultTabs from "../../VaultTabs";
import styles from "../../VaultLibrary.module.css";
import ClinicBrandbar from "../../../ClinicBrandbar";
import { getBrandPackCatalog } from "@/lib/brandPack";
import AssignClient from "./AssignClient";

export const dynamic = "force-dynamic";

export default async function AssignBrandPackPage() {
  const packs = await getBrandPackCatalog();

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

        <VaultTabs active="brand-packs" />

        <div className={styles.settingsPane}>
          <h3>Assign a brand pack</h3>
          <div className={styles.sub}>Find a programme or a client, then pick which pack they should use.</div>

          <AssignClient packs={packs} />
        </div>
      </div>
    </div>
  );
}
