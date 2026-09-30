import Link from "next/link";
import styles from "../../clinic.module.css";
import ClinicBrandbar from "../../ClinicBrandbar";
import { getClinicSettings } from "@/lib/clinicSettings";
import FeatureTogglesClient from "./FeatureTogglesClient";

export const dynamic = "force-dynamic";

export default async function FeatureSettingsPage() {
  const settings = await getClinicSettings();

  return (
    <div className={styles.app}>
      <div className={styles.inner}>
        <ClinicBrandbar />
        <p className={styles.subheading} style={{ marginBottom: -4 }}>
          <Link href="/clinic/tools" className={styles.canvasLink}>
            ← Tools
          </Link>
        </p>
        <h1 className={styles.heading}>Feature settings</h1>
        <p className={styles.subheading}>Switch older screens back on if you need them.</p>

        <FeatureTogglesClient
          initialRunningBuilderEnabled={settings.runningBuilderEnabled}
          initialRunningLaddersEnabled={settings.runningLaddersEnabled}
          initialAiToolsEnabled={settings.aiToolsEnabled}
        />
      </div>
    </div>
  );
}
