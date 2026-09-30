import { notFound } from "next/navigation";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ClinicBrandbar from "../../../../ClinicBrandbar";
import clinicStyles from "../../../../clinic.module.css";
import PlanPreview from "../PlanPreview";
import AssignCancelButtons from "./AssignCancelButtons";
import type { AthenaPlanV1 } from "@/lib/athenaPlan";

export const dynamic = "force-dynamic";

type DraftRow = { id: string; patient_id: string; raw_json: AthenaPlanV1; status: string };

export default async function ImportPlanReviewPage({ params }: { params: Promise<{ id: string; planId: string }> }) {
  const { id, planId } = await params;

  const { data: draft } = await supabaseAdmin
    .from("imported_plans")
    .select("id, patient_id, raw_json, status")
    .eq("id", planId)
    .eq("patient_id", id)
    .maybeSingle<DraftRow>();
  if (!draft) notFound();

  const { data: patient } = await supabaseAdmin
    .from("patients")
    .select("first_name")
    .eq("id", id)
    .maybeSingle<{ first_name: string }>();

  return (
    <div className={clinicStyles.app}>
      <div className={clinicStyles.wideInner}>
        <ClinicBrandbar />
        <p className={clinicStyles.subheading} style={{ marginBottom: -4 }}>
          <Link href={`/clinic/patients/${id}/import-plan`} className={clinicStyles.canvasLink}>
            ← Import plan
          </Link>
        </p>
        <h1 className={clinicStyles.heading}>Review plan</h1>
        <p className={clinicStyles.subheading}>
          For {patient?.first_name ?? "this client"}. Shown exactly as they&apos;d see it. Nothing reaches them
          until you press Assign.
        </p>

        {draft.status !== "draft" && (
          <div className={clinicStyles.notice} style={{ marginBottom: 14 }}>
            This plan has already been {draft.status}.
          </div>
        )}

        <PlanPreview plan={draft.raw_json} />

        {draft.status === "draft" && <AssignCancelButtons planId={draft.id} patientId={id} />}
      </div>
    </div>
  );
}
