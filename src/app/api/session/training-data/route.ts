import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runTrainingAction } from "@/lib/trainingDataActions";

// A client adding to their own training data and tests. Their id comes from
// their login, never from the request, so they can only ever change their
// own record.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const out = await runTrainingAction(user.id, "client", body);
  return NextResponse.json(out.body, { status: out.status });
}
