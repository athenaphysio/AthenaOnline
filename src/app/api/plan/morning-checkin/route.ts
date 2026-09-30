import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { log_id, answer } = body as { log_id?: string; answer?: "better" | "same" | "worse" };
  if (!log_id || !answer || !["better", "same", "worse"].includes(answer)) {
    return NextResponse.json({ error: "log_id and a valid answer are required." }, { status: 400 });
  }

  const { error } = await supabase
    .from("plan_session_logs")
    .update({ next_morning_answer: answer, next_morning_answered_at: new Date().toISOString() })
    .eq("id", log_id)
    .eq("patient_id", user.id);
  if (error) {
    console.error("plan morning checkin failed", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
