import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { IntakeFormFields } from "@/lib/extractIntakeForm";

// The only place any of this actually lands on the patient row -- called
// once David has reviewed and confirmed the extracted fields (and resolved
// any conflicts) on the review screen. Whatever the client sends here is
// trusted as already-reviewed, edited, and confirmed by him.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: patientId } = await params;
  const body = (await request.json()) as Partial<IntakeFormFields>;

  try {
    const { error } = await supabaseAdmin
      .from("patients")
      .update({
        presenting_complaint: body.presenting_complaint ?? null,
        date_of_onset: body.date_of_onset ?? null,
        mechanism_of_injury: body.mechanism_of_injury ?? null,
        body_region: body.body_region ?? null,
        referred_via: body.referred_via ?? null,
        referral_goals_history: body.referral_goals_history ?? null,
      })
      .eq("id", patientId);
    if (error) throw new Error(error.message);

    return NextResponse.json({ id: patientId });
  } catch (err) {
    console.error("save reviewed intake fields failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Save failed: ${detail}` }, { status: 500 });
  }
}
