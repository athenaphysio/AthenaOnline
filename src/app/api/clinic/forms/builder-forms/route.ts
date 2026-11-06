import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { BUILDER_FORMS, builderFormForTitle } from "@/lib/builderForms";

// Adds the Programme intake (standard and Regenerate) and Quick update forms
// to the form library.
// Only creates the ones that are not there already (matched by title), so
// pressing the button twice never makes duplicates.
export async function POST() {
  try {
    const { data: existing, error: listError } = await supabaseAdmin
      .from("forms")
      .select("title")
      .returns<{ title: string }[]>();
    if (listError) throw new Error(listError.message);
    const have = new Set((existing ?? []).map((f) => builderFormForTitle(f.title)?.title).filter(Boolean));

    const created: string[] = [];
    for (const def of BUILDER_FORMS) {
      if (have.has(def.title)) continue;
      const id = crypto.randomUUID();
      const { error: formError } = await supabaseAdmin.from("forms").insert({ id, title: def.title });
      if (formError) throw new Error(formError.message);
      const rows = def.questions.map((q, i) => ({
        form_id: id,
        question_order: i + 1,
        type: q.type,
        prompt: q.prompt,
        options: q.type === "multiple_choice" ? (q.options ?? null) : null,
        required: q.required,
      }));
      const { error: questionsError } = await supabaseAdmin.from("form_questions").insert(rows);
      if (questionsError) {
        await supabaseAdmin.from("forms").delete().eq("id", id);
        throw new Error(questionsError.message);
      }
      created.push(def.title);
    }
    return NextResponse.json({ created });
  } catch (err) {
    console.error("add builder forms failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Couldn't add the forms: ${detail}` }, { status: 500 });
  }
}
