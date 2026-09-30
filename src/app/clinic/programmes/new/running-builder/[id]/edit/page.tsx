import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ProgrammeBuilder, { type WorkoutAssignment } from "@/app/clinic/programmes/ProgrammeBuilder";
import type { Patient } from "@/app/clinic/PatientPicker";
import clinicStyles from "@/app/clinic/clinic.module.css";
import ClinicBrandbar from "@/app/clinic/ClinicBrandbar";
import { getClinicSettings } from "@/lib/clinicSettings";

export const dynamic = "force-dynamic";

type DraftRow = {
  id: string;
  patient_id: string;
  header: { goal: string; event: string | null };
  weekly_structure: { quality_runs: number; easy_runs: number; strength_sessions: number; cross_training_sessions: number };
  weeks: number;
  quality_run_workout_id: string | null;
  easy_run_workout_id: string | null;
  strength_workout_id: string | null;
  cross_training_workout_id: string | null;
};

// Same calendar-spacing spread the approve route uses, so the days David
// sees here in the normal builder match what Approve and assign would
// have produced -- not a clinical choice, just a consistent one.
function assignDays(
  workoutId: string | null,
  workoutName: string,
  count: number,
  usedDays: Set<number>
): WorkoutAssignment[] {
  if (!workoutId || count <= 0) return [];
  const result: WorkoutAssignment[] = [];
  let day = 1;
  while (result.length < count && usedDays.size < 7) {
    while (usedDays.has(day)) day = day >= 7 ? 1 : day + 1;
    usedDays.add(day);
    result.push({ key: crypto.randomUUID(), workout_id: workoutId, workout_name: workoutName, days: [day] });
    day = day >= 7 ? 1 : day + 1;
  }
  return result;
}

// The "Edit" door out of a Running Builder draft: the same ProgrammeBuilder
// every other create path lands in, pre-filled with this draft's patient,
// weeks and the four workouts it already built for real. Opening this page
// changes nothing by itself -- the draft row and its workouts stay exactly
// as they were until David actually saves or sends from inside the builder.
export default async function RunningBuilderEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: draft, error } = await supabaseAdmin
    .from("running_builder_drafts")
    .select(
      "id, patient_id, header, weekly_structure, weeks, quality_run_workout_id, easy_run_workout_id, strength_workout_id, cross_training_workout_id"
    )
    .eq("id", id)
    .maybeSingle<DraftRow>();
  if (error) throw new Error(`Running builder draft query failed: ${error.message}`);
  if (!draft) notFound();

  const workoutIds = [
    draft.quality_run_workout_id,
    draft.easy_run_workout_id,
    draft.strength_workout_id,
    draft.cross_training_workout_id,
  ].filter((wid): wid is string => Boolean(wid));

  const [{ data: patient }, { data: workouts }] = await Promise.all([
    supabaseAdmin.from("patients").select("id, first_name, email").eq("id", draft.patient_id).maybeSingle<Patient>(),
    supabaseAdmin.from("workouts").select("id, name").in("id", workoutIds).returns<{ id: string; name: string }[]>(),
  ]);

  const nameById = new Map((workouts ?? []).map((w) => [w.id, w.name]));
  const usedDays = new Set<number>();
  const initialAssignments: WorkoutAssignment[] = [
    ...assignDays(draft.quality_run_workout_id, nameById.get(draft.quality_run_workout_id ?? "") ?? "Quality run", draft.weekly_structure.quality_runs, usedDays),
    ...assignDays(draft.easy_run_workout_id, nameById.get(draft.easy_run_workout_id ?? "") ?? "Easy run", draft.weekly_structure.easy_runs, usedDays),
    ...assignDays(draft.strength_workout_id, nameById.get(draft.strength_workout_id ?? "") ?? "Strength", draft.weekly_structure.strength_sessions, usedDays),
    ...assignDays(draft.cross_training_workout_id, nameById.get(draft.cross_training_workout_id ?? "") ?? "Cross-training", draft.weekly_structure.cross_training_sessions, usedDays),
  ];

  const title = draft.header.event ? `${draft.header.goal} (${draft.header.event})` : draft.header.goal || "Running programme";
  const programmeId = crypto.randomUUID();
  const { aiToolsEnabled } = await getClinicSettings();

  return (
    <div className={clinicStyles.app}>
      <div className={clinicStyles.wideInner}>
        <ClinicBrandbar />
        <h1 className={clinicStyles.heading}>Edit before sending</h1>
        <p className={clinicStyles.subheading}>
          The normal programme builder, pre-filled from the Running Builder draft. Nothing is sent until you
          save and send from here.
        </p>
        <ProgrammeBuilder
          mode="create"
          programmeId={programmeId}
          initialPatient={patient ?? null}
          initialTitle={title}
          initialBlockLengthWeeks={draft.weeks}
          initialAccessWindowWeeks={6}
          initialAudioUrl={null}
          initialAssignments={initialAssignments}
          initialDeliveryMode="scheduled"
          sourceTemplateId={null}
          isUnder18Template={false}
          aiToolsEnabled={aiToolsEnabled}
        />
      </div>
    </div>
  );
}
