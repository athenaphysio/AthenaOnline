import Link from "next/link";
import type { CSSProperties } from "react";
import clinicStyles from "../../clinic.module.css";
import VaultTabs from "../VaultTabs";
import styles from "../VaultLibrary.module.css";
import ClinicBrandbar from "../../ClinicBrandbar";
import { getBrandPackCatalog } from "@/lib/brandPack";
import BrandPackLibraryClient from "./BrandPackLibraryClient";

export const dynamic = "force-dynamic";

export default async function BrandPacksPage() {
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
          <h3>Brand packs</h3>
          <div className={styles.sub}>
            A named set of images and two colours that a programme or a client can use instead of the default
            Athena look. Admin only -- clients never see this screen.
          </div>

          <div className={clinicStyles.actions} style={{ marginTop: 0, marginBottom: 20 }}>
            <Link
              href="/clinic/vault/brand-packs/new"
              className={clinicStyles.buttonSecondaryAccent}
              style={{ "--zone-accent": "var(--accent-content)", "--zone-accent-soft": "var(--accent-content-soft)" } as CSSProperties}
            >
              + New pack
            </Link>
            <Link href="/clinic/vault/brand-packs/assign" style={{ color: "var(--crimson)", fontSize: 13.5 }}>
              Assign a pack to a programme or client →
            </Link>
          </div>

          <BrandPackLibraryClient packs={packs} />
        </div>
      </div>
    </div>
  );
}
