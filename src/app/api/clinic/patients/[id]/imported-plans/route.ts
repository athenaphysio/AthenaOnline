import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateAthenaPlan } from "@/lib/athenaPlan";

// Paste -> validate -> (maybe) confirm a name mismatch -> draft row. Never
// writes an assigned plan directly -- that only ever happens via the
// separate Assign action on the review screen, once David has actually
// seen the preview.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: patientId } = await params;
  const body = await request.json();
  const { raw_text, force } = body as { raw_text?: string; force?: boolean };

  if (!raw_text || !raw_text.trim()) {
    return NextResponse.json({ errors: ["Paste the plan code first."] }, { status: 400 });
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw_text);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ errors: [`That isn't valid JSON: ${detail}`] }, { status: 400 });
  }

  const result = validateAthenaPlan(parsedJson);
  if (!result.valid) {
    return NextResponse.json({ errors: result.errors }, { status: 400 });
  }
  const plan = result.plan;

  const { data: patient, error: patientError } = await supabaseAdmin
    .from("patients")
    .select("first_name, last_name")
    .eq("id", patientId)
    .maybeSingle<{ first_name: string; last_name: string | null }>();
  if (patientError) return NextResponse.json({ errors: [patientError.message] }, { status: 500 });
  if (!patient) return NextResponse.json({ errors: ["That client account no longer exists."] }, { status: 404 });

  // Loose, case-insensitive match on first name -- the plan's client_name
  // is free text from Claude chat, not guaranteed to match the app's
  // stored name exactly (middle names, nicknames, a typo). Anything less
  // than that gets a confirm step rather than a silent block.
  const patientDisplayName = `${patient.first_name}${patient.last_name ? ` ${patient.last_name}` : ""}`;
  const nameMatches = plan.client_name.toLowerCase().includes(patient.first_name.toLowerCase());
  if (!nameMatches && !force) {
    return NextResponse.json({
      mismatch: true,
      planClientName: plan.client_name,
      patientName: patientDisplayName,
    });
  }

  const { data: draft, error: draftError } = await supabaseAdmin
    .from("imported_plans")
    .insert({
      patient_id: patientId,
      raw_json: plan,
      client_name_in_plan: plan.client_name,
      block_title: plan.block_title,
      start_date: plan.start_date,
    })
    .select("id")
    .single<{ id: string }>();
  if (draftError) return NextResponse.json({ errors: [draftError.message] }, { status: 500 });

  return NextResponse.json({ ok: true, id: draft.id });
}
