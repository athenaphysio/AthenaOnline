import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Plain full-library fetch, mirroring the same query already duplicated
// server-side in workouts/[id]/page.tsx, blocks/[id]/page.tsx and
// blocks/new/page.tsx -- this is the client-fetchable equivalent, for
// builders mounted without a wrapping server component (the inline workout
// editor opened from the Programme Builder's calendar).
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("exercises")
    .select(
      "exercise_id, name_clinical, body_site, thumbnail_url, primary_aim, default_sets, default_reps, default_hold_seconds, default_dosage_text, condition_use_case"
    )
    .eq("active", true)
    .order("exercise_id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ exercises: data ?? [] });
}

// Mirrors POST /api/coach/exercises exactly, but via supabaseAdmin -- the
// Owner's established trust boundary throughout this codebase -- rather
// than the coach's RLS-scoped client, since there's no per-request identity
// to scope against here (the clinic password gate is the only boundary).
export async function POST(request: NextRequest) {
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
    const { error } = await supabaseAdmin.from("exercises").insert({
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
    console.error("add exercise failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Add failed: ${detail}` }, { status: 500 });
  }
}
