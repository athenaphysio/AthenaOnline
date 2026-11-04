import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildRowingPlan, type RowingInputs } from "@/lib/rowing/rowingPlan";

// Remembers what the Rowing Builder was given, keyed on the programme id the
// builder is about to save under. Rebuilt here from the inputs rather than
// trusting numbers sent from the browser.
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { programme_id, patient_id, inputs } = body as { programme_id?: string; patient_id?: string | null; inputs?: RowingInputs };
  if (!programme_id || !inputs) return NextResponse.json({ error: "Missing programme or inputs." }, { status: 400 });
  const result = buildRowingPlan(inputs);
  if (!result.ok) return NextResponse.json({ error: result.errors.join(" ") }, { status: 400 });

  const { error } = await supabaseAdmin.from("rowing_plans").upsert(
    {
      programme_id,
      patient_id: patient_id ?? null,
      inputs,
      reference_split_seconds: result.summary.referenceSplit,
      reference_source: "entry_test",
      slack_weeks: result.summary.slackWeeks,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "programme_id" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
