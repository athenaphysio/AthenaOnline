import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type IncomingQuestion = {
  type: "short_text" | "long_text" | "multiple_choice" | "scale" | "yes_no";
  prompt: string;
  options: string[] | null;
  required: boolean;
};

// Replaces the whole question set on every save, same delete-then-insert-
// fresh pattern already used for programme_workouts on programme save
// (src/app/api/clinic/programmes/[id]/route.ts) -- simpler than diffing
// individual question rows, and questions have no identity worth preserving
// across an edit (existing form_answers reference the question row at time
// of answering, so a past submission stays exactly what was asked then).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { title, questions } = body as { title: string; questions: IncomingQuestion[] };

  if (!title?.trim() || !Array.isArray(questions) || questions.length === 0) {
    return NextResponse.json({ error: "A title and at least one question are required." }, { status: 400 });
  }

  try {
    const { error: formError } = await supabaseAdmin
      .from("forms")
      .update({ title: title.trim(), updated_at: new Date().toISOString() })
      .eq("id", id);
    if (formError) throw new Error(formError.message);

    const { error: deleteError } = await supabaseAdmin.from("form_questions").delete().eq("form_id", id);
    if (deleteError) throw new Error(deleteError.message);

    const rows = questions.map((q, i) => ({
      form_id: id,
      question_order: i + 1,
      type: q.type,
      prompt: q.prompt,
      options: q.type === "multiple_choice" ? q.options : null,
      required: q.required,
    }));
    const { error: insertError } = await supabaseAdmin.from("form_questions").insert(rows);
    if (insertError) throw new Error(insertError.message);

    return NextResponse.json({ id });
  } catch (err) {
    console.error("update form failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Update failed: ${detail}` }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    // Sends/responses/answers all cascade via FK (0022_forms.sql). Answers
    // keep their own prompt/order snapshot (0023_form_answers_snapshot.sql)
    // and only have question_id set to null here, not deleted, but that
    // path isn't reached anyway since form_answers cascades from
    // form_responses -> form_sends -> forms first.
    const { error } = await supabaseAdmin.from("forms").delete().eq("id", id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ id });
  } catch (err) {
    console.error("delete form failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Delete failed: ${detail}` }, { status: 500 });
  }
}
