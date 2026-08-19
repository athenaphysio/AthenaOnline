import { notFound } from "next/navigation";
import VaultTabs from "../../VaultTabs";
import styles from "../../VaultLibrary.module.css";
import ClinicBrandbar from "../../../ClinicBrandbar";
import { getBrandPack, getBrandPackUsage } from "@/lib/brandPack";
import BrandPackEditor from "../BrandPackEditor";

export const dynamic = "force-dynamic";

export default async function EditBrandPackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [pack, usage] = await Promise.all([getBrandPack(id), getBrandPackUsage(id)]);

  if (!pack) notFound();

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
          <h3>Edit brand pack</h3>

          <BrandPackEditor mode="edit" packId={pack.id} isDefault={pack.is_default} initial={pack} usage={usage} />
        </div>
      </div>
    </div>
  );
}
