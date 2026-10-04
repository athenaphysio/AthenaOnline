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
import { planChangedSincePdf } from "@/lib/runningPlanPdf";
import { getClinicSettings } from "@/lib/clinicSettings";
import type { PlanCardData } from "@/lib/planToBuilder";

type AssignmentRow = {
  id: string;
  workout_id: string;
  day_of_week: number | null;
  week_number: number | null;
  sort_order: number | null;
  workouts: { name: string; high_load: boolean; kind: string | null; plan_session: PlanCardData | null };
};

type Programme = {
  id: string;
  patient_id: string;
  rest_days: number[] | null;
  intro: string | null;
  plan_rules: { move_on: string; flare: string } | null;
  week_labels: Record<string, string> | null;
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
        "id, patient_id, rest_days, intro, plan_rules, week_labels, title, block_length_weeks, access_window_weeks, start_date, audio_url, participant_first_name, participant_age, guardian_confirmed_at, delivery_mode, cardio_goal_category, goal_target_id, target_event_date, patients(first_name, email), programme_workouts(id, workout_id, day_of_week, week_number, sort_order, workouts(name, high_load, kind, plan_session))"
      )
      .eq("id", id)
      .maybeSingle<Programme>(),
    supabaseAdmin.from("programme_notes").select("notes").eq("programme_id", id).maybeSingle<{ notes: string | null }>(),
  ]);

  if (!programme) {
    notFound();
  }

  const { data: runningState } = await supabaseAdmin
    .from("running_programme_state")
    .select("id")
    .eq("programme_id", id)
    .maybeSingle<{ id: string }>();
  const runningPlanPdf = runningState ? { planChanged: await planChangedSincePdf(id) } : null;
  const { aiToolsEnabled } = await getClinicSettings();

  // Every-week sessions group by workout (one row, several days), as they
  // always have. Anything tied to a week is its own row: a plan-code card
  // always, a library session grouped per week.
  const byWorkout = new Map<string, WorkoutAssignment>();
  for (const row of [...programme.programme_workouts].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))) {
    const plan = row.workouts.plan_session ?? null;
    const groupKey = plan ? `${row.workout_id}|${row.day_of_week}|${row.week_number}` : `${row.workout_id}|${row.week_number ?? ""}`;
    const existing = byWorkout.get(groupKey);
    if (existing) {
      existing.days.push(row.day_of_week);
    } else {
      byWorkout.set(groupKey, {
        key: groupKey,
        workout_id: row.workout_id,
        workout_name: row.workouts.name,
        high_load: row.workouts.high_load,
        kind: row.workouts.kind ?? undefined,
        days: [row.day_of_week],
        week: row.week_number ?? null,
        plan,
        order: row.sort_order ?? 0,
      });
    }
  }
  const initialAssignments = Array.from(byWorkout.values());
  const initialWeekLabels: Record<number, string> = {};
  for (const [k, v] of Object.entries(programme.week_labels ?? {})) initialWeekLabels[Number(k)] = v;

  const [{ data: goalTargets }, { data: baselineRows }, runningPrefill, cyclingPrefill, { data: draftSessions }, { data: phaseTags }] =
    await Promise.all([
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
    supabaseAdmin.from("phase_tags").select("id, name").order("name"),
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
            Duplicate this programme for another client
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
          initialStartDate={programme.start_date}
          initialRestDays={programme.rest_days ?? []}
          initialIntro={programme.intro}
          initialPlanRules={programme.plan_rules}
          initialWeekLabels={initialWeekLabels}
          initialAudioUrl={programme.audio_url}
          initialAssignments={initialAssignments}
          initialDeliveryMode={programme.delivery_mode}
          initialParticipantFirstName={programme.participant_first_name}
          initialParticipantAge={programme.participant_age}
          initialGuardianConfirmedAt={programme.guardian_confirmed_at}
          initialNotes={notesRow?.notes ?? null}
          phaseTags={phaseTags ?? []}
          aiToolsEnabled={aiToolsEnabled}
          sidePanels={
            <>
              {runningPlanPdf && (
                <div className={styles.card}>
                  <div className={styles.cardTitle}>Running plan PDF</div>
                  {runningPlanPdf.planChanged && (
                    <p className={styles.notice} style={{ marginTop: 0 }}>
                      Your plan has changed. Download a fresh copy if you use the PDF.
                    </p>
                  )}
                  <a
                    href={`/api/clinic/programmes/${programme.id}/running-plan-pdf`}
                    className={styles.buttonSecondary}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
                  >
                    Download my plan (PDF)
                  </a>
                </div>
              )}
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
              <SaveAsTemplateButton programmeId={programme.id} />
            </>
          }
          centrePanels={
            <CardioDraftReview
              programmeId={programme.id}
              hasGoal={programme.cardio_goal_category != null}
              initialSessions={draftSessions ?? []}
            />
          }
        />
      </div>
    </div>
  );
}
