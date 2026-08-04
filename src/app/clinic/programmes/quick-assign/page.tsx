import Image from "next/image";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import styles from "../../clinic.module.css";
import QuickAssignBuilder from "./QuickAssignBuilder";
import type { Patient } from "../../PatientPicker";
import ClinicBrandbar from "../../ClinicBrandbar";

// See the matching comment on the other "new" pages -- without this, the
// ids below get baked into a static page at build time and reused by every
// visitor until the next deploy.
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ patient?: string }>;

export default async function QuickAssignPage({ searchParams }: { searchParams: SearchParams }) {
  const programmeId = crypto.randomUUID();
  const workoutId = crypto.randomUUID();
  const params = await searchParams;

  // Arriving via a patient record's "Assign" button -- pre-fills the
  // patient instead of an empty picker.
  let initialPatient: Patient | null = null;
  if (params.patient) {
    const { data } = await supabaseAdmin
      .from("patients")
      .select("id, first_name, email")
      .eq("id", params.patient)
      .maybeSingle<Patient>();
    initialPatient = data ?? null;
  }

  return (
    <div className={styles.app}>
      <div className={styles.wideInner}>
        <ClinicBrandbar />
        <h1 className={styles.heading}>Quick Assign</h1>
        <p className={styles.subheading} style={{ marginTop: -12 }}>
          A handful of standalone exercises, straight to a client -- no calendar, no clinical guide to write.
        </p>

        <QuickAssignBuilder programmeId={programmeId} workoutId={workoutId} initialPatient={initialPatient} />
      </div>
    </div>
  );
}
