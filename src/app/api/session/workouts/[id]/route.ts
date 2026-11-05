import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// A client removes one of their own uploads, for example the wrong file.
// A result it added for the plans goes with it, but never a Concept2 one.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  const { data: row } = await supabaseAdmin
    .from("uploaded_workouts")
    .select("id, rowing_result_id")
    .eq("id", id)
    .eq("patient_id", user.id)
    .maybeSingle<{ id: string; rowing_result_id: string | null }>();
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { error } = await supabaseAdmin.from("uploaded_workouts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (row.rowing_result_id) {
    await supabaseAdmin.from("rowing_results").delete().eq("id", row.rowing_result_id).eq("source", "file");
  }
  return NextResponse.json({ ok: true });
}
