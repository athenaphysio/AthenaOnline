import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseExerciseFields } from "@/lib/vaultExercise";

// Completing an incomplete exercise (or editing a finished one) updates the
// same row in place, same stable ID -- every block, session and programme
// that already references this exercise_id picks up the change with no
// extra work, since they all read the same row at render time rather than
// copying its fields anywhere.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const fields = parseExerciseFields(body);
  if ("error" in fields) {
    return NextResponse.json({ error: fields.error }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("exercises")
      .update(fields)
      .eq("exercise_id", id)
      .select("exercise_id");
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return NextResponse.json({ error: "Exercise not found." }, { status: 404 });

    return NextResponse.json({ exercise_id: id });
  } catch (err) {
    console.error("update vault exercise failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Save failed: ${detail}` }, { status: 500 });
  }
}
