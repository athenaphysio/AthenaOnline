import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import styles from "../../clinic.module.css";
import ProgrammeBuilder, { type WorkoutAssignment } from "../ProgrammeBuilder";
import SaveAsTemplateButton from "../SaveAsTemplateButton";
import ClinicBrandbar from "../../ClinicBrandbar";
import CardioGoalPanel from "../CardioGoalPanel";
import CardioDraftReview, { type DraftSessionRow } from "../CardioDraftReview";
import { prefillBaseline, type CardioBaseline, type CardioBaselineDiscipline, type GoalTarget } from "@/lib/cardioGoal";

type AssignmentRow = {
  id: string;
  workout_id: string;
  day_of_week: number | null;
  workouts: { name: string; high_load: boolean };
};

type Programme = {
  id: string;
  patient_id: string;
  title: string;
  block_length_weeks: number;
  access_window_weeks: number | null;
  start_date: string;
  audio_url: string | null;
  participant_first_name: string | null;
  participant_age: number | null;
  guardian_confirmed_at: string | null;
  delivery_mode: "scheduled" | "open";
  cardio_goal_category: "ongoing" | "event" | null;
  goal_target_id: string | null;
  target_event_date: string | null;
  patients: { first_name: string; email: string } | null;
  programme_workouts: AssignmentRow[];
};

export default async function EditProgrammePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [{ data: programme }, { data: notesRow }] = await Promise.all([
    supabaseAdmin
      .from("programmes")
      .select(
        "id, patient_id, title, block_length_weeks, access_window_weeks, start_date, audio_url, participant_first_name, participant_age, guardian_confirmed_at, delivery_mode, cardio_goal_category, goal_target_id, target_event_date, patients(first_name, email), programme_workouts(id, workout_id, day_of_week, workouts(name, high_load))"
      )
      .eq("id", id)
      .maybeSingle<Programme>(),
    supabaseAdmin.from("programme_notes").select("notes").eq("programme_id", id).maybeSingle<{ notes: string | null }>(),
  ]);

  if (!programme) {
    notFound();
  }

  const byWorkout = new Map<string, WorkoutAssignment>();
  for (const row of programme.programme_workouts) {
    const existing = byWorkout.get(row.workout_id);
    if (existing) {
      existing.days.push(row.day_of_week);
    } else {
      byWorkout.set(row.workout_id, {
        key: row.workout_id,
        workout_id: row.workout_id,
        workout_name: row.workouts.name,
        high_load: row.workouts.high_load,
        days: [row.day_of_week],
      });
    }
  }
  const initialAssignments = Array.from(byWorkout.values());

  const [{ data: goalTargets }, { data: baselineRows }, runningPrefill, cyclingPrefill, { data: draftSessions }] = await Promise.all([
    supabaseAdmin.from("goal_targets").select("id, name, category").order("category").order("sort_order").returns<GoalTarget[]>(),
    supabaseAdmin
      .from("programme_cardio_baselines")
      .select("discipline, value_number, value_unit, source")
      .eq("programme_id", programme.id)
      .returns<CardioBaseline[]>(),
    prefillBaseline(programme.patient_id, "running"),
    prefillBaseline(programme.patient_id, "cycling"),
    supabaseAdmin
      .from("programme_cardio_draft_sessions")
      .select("id, week_number, day_of_week, kind, description, distance_value, distance_unit, review_status")
      .eq("programme_id", programme.id)
      .order("sort_order")
      .returns<DraftSessionRow[]>(),
  ]);

  const prefillSuggestions: Partial<Record<CardioBaselineDiscipline, { value_number: number; value_unit: "minutes" | "km" | "miles" }>> = {};
  if (runningPrefill) prefillSuggestions.running = runningPrefill;
  if (cyclingPrefill) prefillSuggestions.cycling = cyclingPrefill;

  return (
    <div className={styles.app}>
      <div className={styles.wideInner}>
        <ClinicBrandbar />
        <h1 className={styles.heading}>Edit programme</h1>
        <p className={styles.subheading} style={{ marginTop: -12 }}>
          <Link
            href={`/clinic/programmes/new?source=programme&id=${programme.id}`}
            className={styles.canvasLink}
          >
            Duplicate this programme for another patient
          </Link>
        </p>

        <ProgrammeBuilder
          mode="edit"
          programmeId={programme.id}
          initialPatient={
            programme.patients
              ? { id: programme.patient_id, first_name: programme.patients.first_name, email: programme.patients.email }
              : null
          }
          initialTitle={programme.title}
          initialBlockLengthWeeks={programme.block_length_weeks}
          initialAccessWindowWeeks={programme.access_window_weeks}
          initialAudioUrl={programme.audio_url}
          initialAssignments={initialAssignments}
          initialDeliveryMode={programme.delivery_mode}
          initialParticipantFirstName={programme.participant_first_name}
          initialParticipantAge={programme.participant_age}
          initialGuardianConfirmedAt={programme.guardian_confirmed_at}
          initialNotes={notesRow?.notes ?? null}
        />

        <CardioGoalPanel
          programmeId={programme.id}
          startDate={programme.start_date}
          goalTargets={goalTargets ?? []}
          initialCategory={programme.cardio_goal_category}
          initialGoalTargetId={programme.goal_target_id}
          initialTargetEventDate={programme.target_event_date}
          initialBaselines={baselineRows ?? []}
          prefillSuggestions={prefillSuggestions}
        />

        <CardioDraftReview
          programmeId={programme.id}
          hasGoal={programme.cardio_goal_category != null}
          initialSessions={draftSessions ?? []}
        />

        <SaveAsTemplateButton programmeId={programme.id} />
      </div>
    </div>
  );
}
