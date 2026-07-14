import { supabase } from "@/lib/supabase";
import { getVimeoInfo, type VimeoInfo } from "@/lib/vimeo";
import TodaySession, { type SessionProgrammeItem } from "./TodaySession";
import styles from "./TodaySession.module.css";

type Exercise = {
  exercise_id: string;
  name_clinical: string;
  name_patient_facing: string | null;
  vimeo_url: string | null;
};

type ProgrammeItem = {
  id: string;
  item_order: number;
  sets: number | null;
  reps: number | null;
  hold_seconds: number | null;
  frequency: string | null;
  rationale: string | null;
  exercises: Exercise;
};

type Programme = {
  patient_first_name: string;
  title: string;
  programme_items: ProgrammeItem[];
};

export default async function ProgrammePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const { data: programme } = await supabase
    .from("programmes")
    .select(
      "patient_first_name, title, programme_items(id, item_order, sets, reps, hold_seconds, frequency, rationale, exercises(exercise_id, name_clinical, name_patient_facing, vimeo_url))"
    )
    .eq("share_code", code)
    .maybeSingle<Programme>();

  if (!programme) {
    return (
      <div className={styles.app}>
        <p className={styles.notFound}>
          We couldn&apos;t find this programme. Please check the link, or contact the clinic.
        </p>
      </div>
    );
  }

  const videos: (VimeoInfo | null)[] = await Promise.all(
    programme.programme_items.map((item) => getVimeoInfo(item.exercises.vimeo_url))
  );

  const items: SessionProgrammeItem[] = programme.programme_items.map((item, i) => ({
    ...item,
    video: videos[i],
  }));

  return (
    <TodaySession
      programme={{
        patient_first_name: programme.patient_first_name,
        title: programme.title,
        programme_items: items,
      }}
    />
  );
}
