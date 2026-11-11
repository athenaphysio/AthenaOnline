import Link from "next/link";
import styles from "../../clinic.module.css";
import ClinicBrandbar from "../../ClinicBrandbar";
import { getClinicSettings } from "@/lib/clinicSettings";
import FeatureTogglesClient from "./FeatureTogglesClient";
import SafeguardingRecipients from "./SafeguardingRecipients";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export default async function FeatureSettingsPage() {
  const settings = await getClinicSettings();
  const { data: safeguarding } = await supabaseAdmin
    .from("clinic_settings")
    .select("safeguarding_alert_emails")
    .eq("id", true)
    .maybeSingle<{ safeguarding_alert_emails: string[] | null }>();

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
        initialLegacyPlanCalendarEnabled={settings.legacyPlanCalendarEnabled}
        />

        <SafeguardingRecipients initial={safeguarding?.safeguarding_alert_emails ?? []} owner="athenaphysio@gmail.com" />
      </div>
    </div>
  );
}
