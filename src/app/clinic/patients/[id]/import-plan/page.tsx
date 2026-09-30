import { notFound } from "next/navigation";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ClinicBrandbar from "../../../ClinicBrandbar";
import clinicStyles from "../../../clinic.module.css";
import ImportPlanForm from "./ImportPlanForm";

export const dynamic = "force-dynamic";

export default async function ImportPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: patient } = await supabaseAdmin
    .from("patients")
    .select("first_name")
    .eq("id", id)
    .maybeSingle<{ first_name: string }>();
  if (!patient) notFound();

  return (
    <div className={clinicStyles.app}>
      <div className={clinicStyles.wideInner}>
        <ClinicBrandbar />
        <p className={clinicStyles.subheading} style={{ marginBottom: -4 }}>
          <Link href={`/clinic/patients/${id}`} className={clinicStyles.canvasLink}>
            ← {patient.first_name}
          </Link>
        </p>
        <h1 className={clinicStyles.heading}>Import plan</h1>
        <p className={clinicStyles.subheading}>
          Paste the plan code Claude gave you for {patient.first_name}. Nothing reaches them until you press
          Assign.
        </p>

        <ImportPlanForm patientId={id} />
      </div>
    </div>
  );
}
