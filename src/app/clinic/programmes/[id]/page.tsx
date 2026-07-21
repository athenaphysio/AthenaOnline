import Image from "next/image";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import styles from "../../clinic.module.css";
import ProgrammeEditor, {
  type EditorExercise,
  type LibraryExerciseOption,
} from "../../ProgrammeEditor";

type Week = {
  week_number: number;
  sets: number | null;
  reps: number | null;
  hold_seconds: number | null;
  frequency: string | null;
};

type Item = {
  id: string;
  exercise_id: string;
  item_order: number;
  rationale: string | null;
  exercises: { name_clinical: string };
  programme_item_weeks: Week[];
};

type Programme = {
  id: string;
  patient_first_name: string;
  title: string;
  share_code: string;
  block_length_weeks: number;
  audio_url: string | null;
  ai_draft: { block: string; assumptions: string[]; confirmations: string[] } | null;
  ai_draft_created_at: string | null;
  programme_items: Item[];
};

export default async function EditProgrammePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [{ data: programme }, { data: library }] = await Promise.all([
    supabase
      .from("programmes")
      .select(
        "id, patient_first_name, title, share_code, block_length_weeks, audio_url, ai_draft, ai_draft_created_at, programme_items(id, exercise_id, item_order, rationale, exercises(name_clinical), programme_item_weeks(week_number, sets, reps, hold_seconds, frequency))"
      )
      .eq("id", id)
      .maybeSingle<Programme>(),
    supabase.from("exercises").select("exercise_id, name_clinical").eq("active", true).order("exercise_id"),
  ]);

  if (!programme) {
    notFound();
  }

  const sortedItems = [...programme.programme_items].sort((a, b) => a.item_order - b.item_order);

  const initialExercises: EditorExercise[] = sortedItems.map((item) => ({
    key: item.id,
    exercise_id: item.exercise_id,
    name: item.exercises.name_clinical,
    rationale: item.rationale ?? "",
    weeks: [...item.programme_item_weeks].sort((a, b) => a.week_number - b.week_number),
  }));

  return (
    <div className={styles.app}>
      <div className={styles.wideInner}>
        <div className={styles.brandbar}>
          <Image src="/icons/athena-mark.png" alt="" width={26} height={26} />
          <div className={styles.brandname}>Athena Physio — Clinic</div>
        </div>
        <h1 className={styles.heading}>Edit programme</h1>

        <ProgrammeEditor
          mode="edit"
          programmeId={programme.id}
          shareCode={programme.share_code}
          initialPatientFirstName={programme.patient_first_name}
          initialTitle={programme.title}
          initialBlockLengthWeeks={programme.block_length_weeks}
          initialExercises={initialExercises}
          initialAudioUrl={programme.audio_url}
          aiDraft={
            programme.ai_draft && programme.ai_draft_created_at
              ? { ...programme.ai_draft, created_at: programme.ai_draft_created_at }
              : null
          }
          exerciseLibrary={(library ?? []) as LibraryExerciseOption[]}
        />
      </div>
    </div>
  );
}
