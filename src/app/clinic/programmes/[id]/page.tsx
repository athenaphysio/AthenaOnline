import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import styles from "../../clinic.module.css";
import ProgrammeBuilder, { type WorkoutAssignment } from "../ProgrammeBuilder";
import SaveAsTemplateButton from "../SaveAsTemplateButton";
import ClinicBrandbar from "../../ClinicBrandbar";

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
  audio_url: string | null;
  participant_first_name: string | null;
  participant_age: number | null;
  guardian_confirmed_at: string | null;
  delivery_mode: "scheduled" | "open";
  patients: { first_name: string; email: string } | null;
  programme_workouts: AssignmentRow[];
};

export default async function EditProgrammePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: programme } = await supabaseAdmin
    .from("programmes")
    .select(
      "id, patient_id, title, block_length_weeks, audio_url, participant_first_name, participant_age, guardian_confirmed_at, delivery_mode, patients(first_name, email), programme_workouts(id, workout_id, day_of_week, workouts(name, high_load))"
    )
    .eq("id", id)
    .maybeSingle<Programme>();

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
          initialAudioUrl={programme.audio_url}
          initialAssignments={initialAssignments}
          initialDeliveryMode={programme.delivery_mode}
          initialParticipantFirstName={programme.participant_first_name}
          initialParticipantAge={programme.participant_age}
          initialGuardianConfirmedAt={programme.guardian_confirmed_at}
        />

        <SaveAsTemplateButton programmeId={programme.id} />
      </div>
    </div>
  );
}
