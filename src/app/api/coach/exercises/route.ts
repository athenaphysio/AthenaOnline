import { NextRequest, NextResponse } from "next/server";
import { getCoach } from "@/lib/coachAuth";
import { createClient } from "@/lib/supabase/server";

// Uses the coach's own authenticated client, never supabaseAdmin -- the
// insert only succeeds because of the RLS policy scoped to role='coach' on
// public.exercises (0016_coach_rls.sql), not because this route trusts the
// caller. A patient's own login hitting this same table would be refused
// by the database itself.
export async function POST(request: NextRequest) {
  const coach = await getCoach();
  if (!coach) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name_clinical, body_site, equipment, difficulty } = body as {
    name_clinical: string;
    body_site: string | null;
    equipment: string | null;
    difficulty: string | null;
  };

  if (!name_clinical?.trim()) {
    return NextResponse.json({ error: "Exercise name is required." }, { status: 400 });
  }

  const exerciseId = `EX-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("exercises").insert({
      exercise_id: exerciseId,
      name_clinical: name_clinical.trim(),
      body_site: body_site?.trim() || null,
      equipment: equipment?.trim() || null,
      difficulty: difficulty?.trim() || null,
      active: true,
    });
    if (error) throw new Error(error.message);

    return NextResponse.json({ exercise_id: exerciseId });
  } catch (err) {
    console.error("coach add exercise failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Add failed: ${detail}` }, { status: 500 });
  }
}
