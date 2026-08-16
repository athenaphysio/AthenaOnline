import styles from "../../clinic.module.css";
import ClinicBrandbar from "../../ClinicBrandbar";
import CardioBlockPageClient from "../CardioBlockPageClient";
import { newCardioBlockDetail } from "@/lib/cardioBlock";

// Same reasoning as blocks/new/page.tsx -- without this the id below would
// get baked into static HTML at build time and every visitor would share it.
export const dynamic = "force-dynamic";

export default function NewCardioBlockPage() {
  const id = crypto.randomUUID();
  const initial = newCardioBlockDetail(id, "", "running", "steady_state", "general");

  return (
    <div className={styles.app}>
      <div className={styles.wideInner}>
        <ClinicBrandbar />
        <h1 className={styles.heading}>New cardio block</h1>
        <p className={styles.subheading}>
          One fixed prescription, reusable from any Workout, same as a Block but without week-to-week
          progression.
        </p>

        <CardioBlockPageClient mode="create" initial={initial} />
      </div>
    </div>
  );
}
