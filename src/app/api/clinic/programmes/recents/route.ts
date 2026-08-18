import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Everything that has actually been handed to a client, most recent first.
//
// That is exactly the programmes table and nothing else: a workout can only
// reach a client through programme_workouts, whose programme_id is NOT NULL,
// and the client-facing session page is keyed by programme id. So a
// standalone workout assigned to someone is a programme too -- one with
// delivery_mode "open" and a single unscheduled workout (see migration
// 0019, which dropped NOT NULL on day_of_week precisely so that could
// exist). No union with workouts is needed, and every row here duplicates
// the same way.
type Row = {
  id: string;
  title: string;
  patient_first_name: string | null;
  delivery_mode: "scheduled" | "open";
  block_length_weeks: number;
  created_at: string;
  programme_workouts: {
    day_of_week: number | null;
    workouts: {
      name: string;
      workout_items: {
        exercises: { name_clinical: string } | null;
        blocks: { name: string } | null;
        cardio_blocks: { name: string } | null;
      }[];
    } | null;
  }[];
};

export type RecentProgramme = {
  id: string;
  title: string;
  patientFirstName: string | null;
  deliveryMode: "scheduled" | "open";
  blockLengthWeeks: number;
  createdAt: string;
  workoutCount: number;
  /** Every exercise, block and cardio name inside this programme, lowercased
   * and joined. Sent so the search box can match on what a programme
   * actually contains, not just what it was called -- "shoulder" finds a
   * programme full of shoulder work whose title never says shoulder. */
  contents: string;
};

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("programmes")
    .select(
      "id, title, patient_first_name, delivery_mode, block_length_weeks, created_at, programme_workouts(day_of_week, workouts(name, workout_items(exercises(name_clinical), blocks(name), cardio_blocks(name))))"
    )
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<Row[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const programmes: RecentProgramme[] = (data ?? []).map((p) => {
    const names: string[] = [];
    for (const pw of p.programme_workouts ?? []) {
      if (!pw.workouts) continue;
      names.push(pw.workouts.name);
      for (const item of pw.workouts.workout_items ?? []) {
        const name = item.exercises?.name_clinical ?? item.blocks?.name ?? item.cardio_blocks?.name;
        if (name) names.push(name);
      }
    }
    return {
      id: p.id,
      title: p.title,
      patientFirstName: p.patient_first_name,
      deliveryMode: p.delivery_mode,
      blockLengthWeeks: p.block_length_weeks,
      createdAt: p.created_at,
      workoutCount: (p.programme_workouts ?? []).filter((pw) => pw.workouts).length,
      contents: names.join(" ").toLowerCase(),
    };
  });

  return NextResponse.json({ programmes });
}
