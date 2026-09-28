import { notFound } from "next/navigation";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveWorkoutItems, toSessionItems } from "@/lib/workoutResolution";
import type { SessionItem } from "@/app/session/ExerciseList";
import ExerciseList from "@/app/session/ExerciseList";
import ClinicBrandbar from "@/app/clinic/ClinicBrandbar";
import clinicStyles from "@/app/clinic/clinic.module.css";
import ApproveButton from "./ApproveButton";

export const dynamic = "force-dynamic";

type LockedBlock = {
  name: string;
  exercises: { exercise_id: string | null; name: string; sets: number | null; reps: number | null }[];
  unlock_condition: string;
};

type DraftRow = {
  id: string;
  patient_id: string;
  status: "draft" | "approved";
  ladder_id: string | null;
  start_rung_number: number | null;
  header: { goal: string; event: string | null; event_date: string | null; current_capacity: string | null; cross_training_baseline: string | null };
  weekly_structure: { quality_runs: number; easy_runs: number; strength_sessions: number; cross_training_sessions: number; easy_run_treadmill: boolean };
  cross_training: { name: string; description: string | null }[];
  locked_blocks: LockedBlock[];
  rules: string | null;
  flags: string[];
  weeks: number;
  quality_run_workout_id: string | null;
  easy_run_workout_id: string | null;
  strength_workout_id: string | null;
  cross_training_workout_id: string | null;
  programme_id: string | null;
};

async function sessionItemsFor(workoutId: string | null): Promise<SessionItem[] | null> {
  if (!workoutId) return null;
  const resolved = await resolveWorkoutItems(workoutId, 1);
  if (resolved.length === 0) return null;
  return toSessionItems(resolved);
}

// Shows the draft exactly as the client would see it (the same
// ExerciseList component the real session page uses, read-only here --
// no completion prop), with every flag visible in one place at the top,
// before David decides to Edit or Approve and assign. Nothing here is
// patient-visible yet: the workouts/blocks the note built are real rows,
// but no `programmes` row exists until Approve actually runs.
export default async function RunningBuilderReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: draft, error } = await supabaseAdmin
    .from("running_builder_drafts")
    .select(
      "id, patient_id, status, ladder_id, start_rung_number, header, weekly_structure, cross_training, locked_blocks, rules, flags, weeks, quality_run_workout_id, easy_run_workout_id, strength_workout_id, cross_training_workout_id, programme_id"
    )
    .eq("id", id)
    .maybeSingle<DraftRow>();
  if (error) throw new Error(`Running builder draft query failed: ${error.message}`);
  if (!draft) notFound();

  const [{ data: patient }, ladderRes] = await Promise.all([
    supabaseAdmin.from("patients").select("first_name").eq("id", draft.patient_id).maybeSingle<{ first_name: string }>(),
    draft.ladder_id
      ? supabaseAdmin.from("running_ladders").select("name").eq("id", draft.ladder_id).maybeSingle<{ name: string }>()
      : Promise.resolve({ data: null }),
  ]);

  const [quality, easy, strength, crossTraining] = await Promise.all([
    sessionItemsFor(draft.quality_run_workout_id),
    sessionItemsFor(draft.easy_run_workout_id),
    sessionItemsFor(draft.strength_workout_id),
    sessionItemsFor(draft.cross_training_workout_id),
  ]);

  return (
    <div className={clinicStyles.app}>
      <div className={clinicStyles.wideInner}>
        <ClinicBrandbar />
        <h1 className={clinicStyles.heading}>Running Builder draft</h1>
        <p className={clinicStyles.subheading}>
          For {patient?.first_name ?? "this client"}. Shown exactly as they&apos;d see it in their own session.
        </p>

        {draft.status === "approved" && (
          <div className={clinicStyles.notice} style={{ marginBottom: 14 }}>
            This draft has already been approved and assigned.
          </div>
        )}

        {draft.flags.length > 0 && (
          <div className={clinicStyles.warningCard}>
            <div className={clinicStyles.warningTitle}>
              {draft.flags.length} thing{draft.flags.length === 1 ? "" : "s"} to check before assigning
            </div>
            {draft.flags.map((f, i) => (
              <div key={i} className={clinicStyles.warningItem}>
                {f}
              </div>
            ))}
          </div>
        )}

        <div className={clinicStyles.card}>
          <div className={clinicStyles.cardTitle}>{draft.header.goal || "Goal not stated"}</div>
          {draft.header.event && (
            <p className={clinicStyles.notice} style={{ marginTop: 0 }}>
              Event: {draft.header.event}
              {draft.header.event_date ? `, ${draft.header.event_date}` : ""}
            </p>
          )}
          {draft.header.current_capacity && (
            <p className={clinicStyles.notice} style={{ marginTop: 0 }}>Current capacity: {draft.header.current_capacity}</p>
          )}
          {draft.header.cross_training_baseline && (
            <p className={clinicStyles.notice} style={{ marginTop: 0 }}>
              Cross-training baseline: {draft.header.cross_training_baseline}
            </p>
          )}
          <p className={clinicStyles.notice} style={{ marginTop: 0, marginBottom: 0 }}>
            Ladder: {ladderRes.data?.name ?? "not matched"}
            {draft.start_rung_number ? `, starting rung ${draft.start_rung_number}` : ", starting rung not confirmed"}
            {" "}&middot; {draft.weeks} week block
          </p>
        </div>

        {quality && (
          <div className={clinicStyles.card}>
            <div className={clinicStyles.cardTitle}>
              Quality run{draft.weekly_structure.quality_runs > 1 ? ` (${draft.weekly_structure.quality_runs}x per week)` : ""}
            </div>
            <ExerciseList items={quality} />
          </div>
        )}

        {easy && (
          <div className={clinicStyles.card}>
            <div className={clinicStyles.cardTitle}>
              Easy run{draft.weekly_structure.easy_runs > 1 ? ` (${draft.weekly_structure.easy_runs}x per week)` : ""}
            </div>
            <ExerciseList items={easy} />
          </div>
        )}

        {strength && (
          <div className={clinicStyles.card}>
            <div className={clinicStyles.cardTitle}>
              Strength{draft.weekly_structure.strength_sessions > 1 ? ` (${draft.weekly_structure.strength_sessions}x per week)` : ""}
            </div>
            <ExerciseList items={strength} />
          </div>
        )}

        {crossTraining && (
          <div className={clinicStyles.card}>
            <div className={clinicStyles.cardTitle}>
              Cross-training
              {draft.weekly_structure.cross_training_sessions > 1 ? ` (${draft.weekly_structure.cross_training_sessions}x per week)` : ""}
            </div>
            <ExerciseList items={crossTraining} />
          </div>
        )}

        {draft.locked_blocks.length > 0 && (
          <div className={clinicStyles.card} style={{ opacity: 0.6 }}>
            <div className={clinicStyles.cardTitle}>Locked, unlocks later</div>
            {draft.locked_blocks.map((b, i) => (
              <div key={i} style={{ marginBottom: 14 }}>
                <div style={{ fontWeight: 600 }}>{b.name}</div>
                <p className={clinicStyles.notice} style={{ marginTop: 2 }}>Unlocks when: {b.unlock_condition}</p>
                <ul className={clinicStyles.list}>
                  {b.exercises.map((e, j) => (
                    <li key={j}>
                      {e.name}
                      {e.sets && e.reps ? `, ${e.sets} x ${e.reps}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {draft.weeks > 1 && (
          <p className={clinicStyles.notice}>Weeks 2 to {draft.weeks}: next rung unlocks when ready.</p>
        )}

        {draft.rules && (
          <div className={clinicStyles.card}>
            <div className={clinicStyles.cardTitle}>Load management and flare-up rules</div>
            <p style={{ fontSize: 13.5, color: "var(--ink)", lineHeight: 1.55, margin: 0, whiteSpace: "pre-wrap" }}>{draft.rules}</p>
          </div>
        )}

        <div className={clinicStyles.actions} style={{ flexDirection: "row", marginTop: 24 }}>
          <Link
            href={`/clinic/programmes/new/running-builder/${draft.id}/edit`}
            className={clinicStyles.buttonSecondary}
            style={{ width: "auto", padding: "0 28px", display: "inline-flex", alignItems: "center" }}
          >
            Edit
          </Link>
          {draft.status !== "approved" && <ApproveButton draftId={draft.id} />}
        </div>
      </div>
    </div>
  );
}
