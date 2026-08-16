import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type IncomingAssignment = {
  workout_id: string;
  day_of_week: number | null;
};

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { title, block_length_weeks, access_window_weeks, audio_url, assignments, delivery_mode } = body as {
    title: string;
    block_length_weeks: number;
    access_window_weeks?: number | null;
    audio_url: string | null;
    assignments: IncomingAssignment[];
    delivery_mode?: "scheduled" | "open";
  };

  if (!title || !block_length_weeks || !Array.isArray(assignments)) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  try {
    // The patient a programme belongs to is fixed at creation and never
    // changes here -- only the content of the programme itself. delivery_mode
    // can change here, though -- that's the "switch delivery mode" feature.
    const { data: programme, error: programmeError } = await supabaseAdmin
      .from("programmes")
      .update({
        title,
        block_length_weeks,
        access_window_weeks: access_window_weeks ?? null,
        audio_url: audio_url ?? null,
        updated_at: new Date().toISOString(),
        ...(delivery_mode ? { delivery_mode } : {}),
      })
      .eq("id", id)
      .select("id")
      .single();

    if (programmeError) throw new Error(programmeError.message);

    // Replace the weekly schedule fresh rather than diffing individual rows.
    const { error: deleteError } = await supabaseAdmin.from("programme_workouts").delete().eq("programme_id", id);
    if (deleteError) throw new Error(deleteError.message);

    if (assignments.length > 0) {
      const rows = assignments.map((a) => ({
        programme_id: id,
        workout_id: a.workout_id,
        day_of_week: a.day_of_week,
      }));
      const { error: assignError } = await supabaseAdmin.from("programme_workouts").insert(rows);
      if (assignError) throw new Error(assignError.message);
    }

    return NextResponse.json({ id: programme.id });
  } catch (err) {
    console.error("update programme failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Update failed: ${detail}` }, { status: 500 });
  }
}
