import { NextRequest, NextResponse } from "next/server";
import { getCoach } from "@/lib/coachAuth";
import { createClient } from "@/lib/supabase/server";

type IncomingAssignment = {
  workout_id: string;
  day_of_week: number | null;
};

// Mirrors /api/clinic/programme-templates/[id]/route.ts's request shape
// exactly, but runs on the coach's own authenticated client, never
// supabaseAdmin. The actual authorization is the RLS update/insert/delete
// policies added in 0017_coach_template_editing.sql, scoped to templates
// this coach is assigned to -- this route can't reach anything else even
// if it tried.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const coach = await getCoach();
  if (!coach) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { name, block_length_weeks, assignments } = body as {
    name: string;
    block_length_weeks: number;
    assignments: IncomingAssignment[];
  };

  if (!name || !block_length_weeks || !Array.isArray(assignments)) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    const { data: template, error: templateError } = await supabase
      .from("programme_templates")
      .update({ name, block_length_weeks, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id")
      .single();
    if (templateError) throw new Error(templateError.message);

    const { error: deleteError } = await supabase
      .from("programme_template_workouts")
      .delete()
      .eq("template_id", id);
    if (deleteError) throw new Error(deleteError.message);

    if (assignments.length > 0) {
      const rows = assignments.map((a) => ({
        template_id: id,
        workout_id: a.workout_id,
        day_of_week: a.day_of_week,
      }));
      const { error: assignError } = await supabase.from("programme_template_workouts").insert(rows);
      if (assignError) throw new Error(assignError.message);
    }

    return NextResponse.json({ id: template.id });
  } catch (err) {
    console.error("coach update programme template failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Update failed: ${detail}` }, { status: 500 });
  }
}
