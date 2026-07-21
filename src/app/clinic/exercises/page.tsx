import Image from "next/image";
import { supabase } from "@/lib/supabase";
import styles from "../clinic.module.css";
import ExerciseAudioList, { type ExerciseRow } from "./ExerciseAudioList";

export default async function ExercisesAudioPage() {
  const { data } = await supabase
    .from("exercises")
    .select("exercise_id, name_clinical, audio_url")
    .eq("active", true)
    .order("exercise_id")
    .returns<ExerciseRow[]>();

  const exercises = data ?? [];
  const recordedCount = exercises.filter((e) => e.audio_url).length;

  return (
    <div className={styles.app}>
      <div className={styles.inner}>
        <div className={styles.brandbar}>
          <Image src="/icons/athena-mark.png" alt="" width={26} height={26} />
          <div className={styles.brandname}>Athena Physio — Clinic</div>
        </div>

        <h1 className={styles.heading}>Exercise coaching cues</h1>
        <p className={styles.subheading}>
          {recordedCount} of {exercises.length} exercises have a recording. Recorded once,
          reused for every patient prescribed that exercise.
        </p>

        <ExerciseAudioList exercises={exercises} />
      </div>
    </div>
  );
}
