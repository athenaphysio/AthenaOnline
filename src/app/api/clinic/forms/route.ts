import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type IncomingQuestion = {
  type: "short_text" | "long_text" | "multiple_choice" | "scale" | "yes_no";
  prompt: string;
  options: string[] | null;
  required: boolean;
};

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { id, title, questions } = body as { id: string; title: string; questions: IncomingQuestion[] };

  if (!id || !title?.trim() || !Array.isArray(questions) || questions.length === 0) {
    return NextResponse.json({ error: "A title and at least one question are required." }, { status: 400 });
  }

  try {
    const { error: formError } = await supabaseAdmin.from("forms").insert({ id, title: title.trim() });
    if (formError) throw new Error(formError.message);

    const rows = questions.map((q, i) => ({
      form_id: id,
      question_order: i + 1,
      type: q.type,
      prompt: q.prompt,
      options: q.type === "multiple_choice" ? q.options : null,
      required: q.required,
    }));
    const { error: questionsError } = await supabaseAdmin.from("form_questions").insert(rows);
    if (questionsError) throw new Error(questionsError.message);

    return NextResponse.json({ id });
  } catch (err) {
    console.error("create form failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Create failed: ${detail}` }, { status: 500 });
  }
}
