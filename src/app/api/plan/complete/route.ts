import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// The plan-v1 equivalent of session/complete -- keyed on the plan
// session's own stable id, not a library id. Runs entirely through the
// patient's own authenticated client; RLS on plan_session_logs (auth.uid()
// = patient_id) is the real backstop.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { imported_plan_id, session_id, quality, pain, note } = body as {
    imported_plan_id?: string;
    session_id?: string;
    quality?: "finished" | "partial" | "not_done";
    pain?: number;
    note?: string;
  };
  if (!imported_plan_id || !session_id) {
    return NextResponse.json({ error: "imported_plan_id and session_id are required." }, { status: 400 });
  }

  const { data: plan } = await supabase
    .from("imported_plans")
    .select("id")
    .eq("id", imported_plan_id)
    .eq("patient_id", user.id)
    .maybeSingle<{ id: string }>();
  if (!plan) return NextResponse.json({ error: "Plan not found." }, { status: 404 });

  const { error } = await supabase.from("plan_session_logs").upsert(
    {
      imported_plan_id,
      patient_id: user.id,
      session_id,
      completed_quality: quality ?? null,
      pain_score: pain ?? null,
      note: note?.trim() || null,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "imported_plan_id,session_id" }
  );
  if (error) {
    console.error("plan session log failed", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
