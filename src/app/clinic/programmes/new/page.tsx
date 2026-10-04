import Image from "next/image";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import styles from "../../clinic.module.css";
import NewProgrammeChoice from "./NewProgrammeChoice";
import type { Patient } from "../../PatientPicker";
import ClinicBrandbar from "../../ClinicBrandbar";
import { getClinicSettings } from "@/lib/clinicSettings";

// See the matching comment in clinic/blocks/new/page.tsx -- without this,
// the programmeId below gets baked into a static page at build time and
// reused by every visitor until the next deploy.
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ source?: string; id?: string; patient?: string }>;

export default async function NewProgrammePage({ searchParams }: { searchParams: SearchParams }) {
  const programmeId = crypto.randomUUID();
  const params = await searchParams;

  let autoSource: { type: "template" | "programme"; id: string } | null = null;
  if ((params.source === "template" || params.source === "programme") && params.id) {
    autoSource = { type: params.source, id: params.id };
  }

  // Arriving via a patient record's "Assign" button -- pre-fills (not
  // locks) the patient across every path this page can lead to, instead of
  // showing an empty picker for someone already on-screen a click ago.
  let initialPatient: Patient | null = null;
  if (params.patient) {
    const { data } = await supabaseAdmin
      .from("patients")
      .select("id, first_name, email")
      .eq("id", params.patient)
      .maybeSingle<Patient>();
    initialPatient = data ?? null;
  }

  const { runningBuilderEnabled, aiToolsEnabled } = await getClinicSettings();

  return (
    <div className={styles.app}>
      <div className={styles.wideInner}>
        <ClinicBrandbar />
        <h1 className={styles.heading}>New programme</h1>
        <p className={styles.subheading}>
          {autoSource
            ? "Pick a client, build their weekly schedule from your Workouts, then send."
            : "Build a programme, or hand a client a quick set of exercises."}
        </p>

        <NewProgrammeChoice
          programmeId={programmeId}
          autoSource={autoSource}
          initialPatient={initialPatient}
          runningBuilderEnabled={runningBuilderEnabled}
          aiToolsEnabled={aiToolsEnabled}
        />
      </div>
    </div>
  );
}
