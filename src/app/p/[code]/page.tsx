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
  rationale: string | null;
  sets: number | null;
  reps: number | null;
  hold_seconds: number | null;
  percent_max: number | null;
  frequency: string | null;
  exercises: Exercise;
};

type ProgrammeItem = {
  id: string;
  item_order: number;
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
      "patient_first_name, title, audio_url, block_length_weeks, start_date, programme_items(id, item_order, programme_item_weeks(week_number, rationale, sets, reps, hold_seconds, percent_max, frequency, exercises(exercise_id, name_clinical, name_patient_facing, vimeo_url)))"
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

  const currentWeeks = programme.programme_items.map(
    (item) =>
      item.programme_item_weeks.find((w) => w.week_number === week) ??
      item.programme_item_weeks[item.programme_item_weeks.length - 1] ??
      null
  );

  const videos: (VimeoInfo | null)[] = await Promise.all(
    currentWeeks.map((w) => getVimeoInfo(w?.exercises.vimeo_url ?? null))
  );

  const items = programme.programme_items
    .map((item, i) => {
      const thisWeek = currentWeeks[i];
      if (!thisWeek) return null;
      return {
        id: item.id,
        item_order: item.item_order,
        rationale: thisWeek.rationale,
        exercises: {
          exercise_id: thisWeek.exercises.exercise_id,
          name_clinical: thisWeek.exercises.name_clinical,
          name_patient_facing: thisWeek.exercises.name_patient_facing,
        },
        video: videos[i],
        sets: thisWeek.sets,
        reps: thisWeek.reps,
        hold_seconds: thisWeek.hold_seconds,
        percent_max: thisWeek.percent_max,
        frequency: thisWeek.frequency,
      };
    })
    .filter((item): item is SessionProgrammeItem => item !== null);

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
