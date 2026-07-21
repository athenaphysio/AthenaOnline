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

type Week = {
  week_number: number;
  sets: number | null;
  reps: number | null;
  hold_seconds: number | null;
  frequency: string | null;
};

type ProgrammeItem = {
  id: string;
  item_order: number;
  rationale: string | null;
  exercises: Exercise;
  programme_item_weeks: Week[];
};

type Programme = {
  patient_first_name: string;
  title: string;
  audio_url: string | null;
  block_length_weeks: number;
  start_date: string;
  programme_items: ProgrammeItem[];
};

function currentWeekNumber(startDate: string, blockLengthWeeks: number): number {
  const elapsedMs = Date.now() - new Date(startDate).getTime();
  const elapsedWeeks = Math.floor(elapsedMs / (7 * 24 * 60 * 60 * 1000));
  const week = elapsedWeeks + 1;
  return Math.min(Math.max(week, 1), blockLengthWeeks);
}

export default async function ProgrammePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const { data: programme } = await supabase
    .from("programmes")
    .select(
      "patient_first_name, title, audio_url, block_length_weeks, start_date, programme_items(id, item_order, rationale, exercises(exercise_id, name_clinical, name_patient_facing, vimeo_url), programme_item_weeks(week_number, sets, reps, hold_seconds, frequency))"
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

  const week = currentWeekNumber(programme.start_date, programme.block_length_weeks);

  const videos: (VimeoInfo | null)[] = await Promise.all(
    programme.programme_items.map((item) => getVimeoInfo(item.exercises.vimeo_url))
  );

  const items: SessionProgrammeItem[] = programme.programme_items.map((item, i) => {
    const thisWeek =
      item.programme_item_weeks.find((w) => w.week_number === week) ??
      item.programme_item_weeks[item.programme_item_weeks.length - 1] ??
      null;

    return {
      id: item.id,
      item_order: item.item_order,
      rationale: item.rationale,
      exercises: item.exercises,
      video: videos[i],
      sets: thisWeek?.sets ?? null,
      reps: thisWeek?.reps ?? null,
      hold_seconds: thisWeek?.hold_seconds ?? null,
      frequency: thisWeek?.frequency ?? null,
    };
  });

  return (
    <TodaySession
      programme={{
        patient_first_name: programme.patient_first_name,
        title: programme.title,
        audio_url: programme.audio_url,
        programme_items: items,
      }}
    />
  );
}
