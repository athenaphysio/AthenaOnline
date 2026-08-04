import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { deepCopyAssignments } from "@/lib/copyProgrammeContent";

// Promotes an existing bespoke programme into a reusable Programme Template
// -- a real, independent copy of its weekly schedule (own workouts, own
// blocks -- see copyProgrammeContent.ts), not tied back to the original
// patient. Deliberately does NOT link the original programme to the new
// template (no source_template_id update): this is a master copy for
// growing the template library, not a way to grant a future Coach
// visibility into this specific patient. If David wants that, assigning a
// Coach to a programme's own patient is a separate, explicit action.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { name } = body as { name: string };

  if (!name?.trim()) {
    return NextResponse.json({ error: "Template name is required." }, { status: 400 });
  }

  try {
    const { data: programme, error: programmeError } = await supabaseAdmin
      .from("programmes")
      .select("block_length_weeks, delivery_mode, programme_workouts(workout_id, day_of_week)")
      .eq("id", id)
      .maybeSingle<{
        block_length_weeks: number;
        delivery_mode: "scheduled" | "open";
        programme_workouts: { workout_id: string; day_of_week: number | null }[];
      }>();
    if (programmeError) throw new Error(programmeError.message);
    if (!programme) {
      return NextResponse.json({ error: "Programme not found." }, { status: 404 });
    }

    const assignments = await deepCopyAssignments(programme.programme_workouts);

    const templateId = crypto.randomUUID();
    const { error: templateError } = await supabaseAdmin.from("programme_templates").insert({
      id: templateId,
      name: name.trim(),
      block_length_weeks: programme.block_length_weeks,
      delivery_mode: programme.delivery_mode,
    });
    if (templateError) throw new Error(templateError.message);

    if (assignments.length > 0) {
      const rows = assignments.flatMap((a) => a.days.map((day) => ({ template_id: templateId, workout_id: a.workout_id, day_of_week: day })));
      const { error: assignError } = await supabaseAdmin.from("programme_template_workouts").insert(rows);
      if (assignError) throw new Error(assignError.message);
    }

    return NextResponse.json({ template_id: templateId });
  } catch (err) {
    console.error("save as template failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Save as template failed: ${detail}` }, { status: 500 });
  }
}
