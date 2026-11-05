import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { londonDay, readWorkoutFile, WorkoutFileError } from "@/lib/workoutFile";
import { paceFromResult } from "@/lib/rowing/zones";

const MAX_BYTES = 4 * 1024 * 1024;

// A client uploads a workout file. The file is read here and thrown away;
// only the numbers are kept. Rows and runs also become results that the
// rowing and running plans read, unless the same session is already there
// (from Concept2, say).
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  const note = String(form.get("note") || "").trim().slice(0, 500) || null;
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choose a file first." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That file is larger than 4MB. Workout files are usually much smaller, so it may not be the right one." }, { status: 400 });

  let w;
  try {
    w = await readWorkoutFile(new Uint8Array(await file.arrayBuffer()), file.name);
  } catch (err) {
    const message = err instanceof WorkoutFileError ? err.message : "That file couldn't be read. Try exporting it again, as a .FIT file.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from("uploaded_workouts")
    .select("id")
    .eq("patient_id", user.id)
    .eq("started_at", w.startedAt)
    .eq("duration_seconds", w.durationSeconds)
    .maybeSingle<{ id: string }>();
  if (existing) return NextResponse.json({ error: "That workout is already here, so nothing was added twice." }, { status: 409 });

  // Rows and runs feed the plans, unless the same session already came in.
  let rowingResultId: string | null = null;
  if ((w.sport === "row" || w.sport === "run") && w.distanceM && w.distanceM > 0) {
    const day = londonDay(w.startedAt);
    const { data: same } = await supabaseAdmin
      .from("rowing_results")
      .select("id, distance_m, time_tenths")
      .eq("patient_id", user.id)
      .eq("sport", w.sport)
      .eq("rowed_on", day)
      .returns<{ id: string; distance_m: number; time_tenths: number }[]>();
    const duplicate = (same ?? []).find(
      (r) => Math.abs(r.distance_m - (w.distanceM as number)) <= (w.distanceM as number) * 0.01 && Math.abs(r.time_tenths / 10 - w.durationSeconds) <= w.durationSeconds * 0.02
    );
    if (duplicate) rowingResultId = duplicate.id;
    else {
      const { data: inserted } = await supabaseAdmin
        .from("rowing_results")
        .insert({
          patient_id: user.id,
          source: "file",
          sport: w.sport,
          rowed_on: day,
          distance_m: Math.round(w.distanceM),
          time_tenths: Math.round(w.durationSeconds * 10),
          avg_split_seconds: paceFromResult(w.sport, w.distanceM, w.durationSeconds),
          stroke_rate: w.sport === "row" ? w.avgCadence : null,
          avg_hr: w.avgHr,
          workout_type: null,
          note,
        })
        .select("id")
        .single<{ id: string }>();
      rowingResultId = inserted?.id ?? null;
    }
  }

  const { error } = await supabaseAdmin.from("uploaded_workouts").insert({
    patient_id: user.id,
    file_name: file.name.slice(0, 200),
    sport: w.sport,
    sport_label: w.sportLabel,
    started_at: w.startedAt,
    duration_seconds: w.durationSeconds,
    distance_m: w.distanceM,
    avg_hr: w.avgHr,
    max_hr: w.maxHr,
    avg_power: w.avgPower,
    max_power: w.maxPower,
    avg_cadence: w.avgCadence,
    calories: w.calories,
    device: w.device,
    laps: w.laps,
    note,
    rowing_result_id: rowingResultId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, workout: w });
}
