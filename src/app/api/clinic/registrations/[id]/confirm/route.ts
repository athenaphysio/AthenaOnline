import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { applyRegistration, REGISTRATION_COLUMNS, type RegistrationRow } from "@/lib/registrations";

// Confirming a registration means finding the Athena Online account that
// belongs to it and copying every answer across -- Phase 5/6 of the
// brief: "in one action rather than retyping anything". The match is by
// email (Phase 6.1's own suggestion): the account is created by the
// patient's own /start signup straight after submitting, under the same
// email captured here, so by the time David reviews this there's
// normally already a patients row waiting. If not, there's nothing to
// confirm into yet -- this returns a clear "no account yet" rather than
// silently doing nothing.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: registration, error: fetchError } = await supabaseAdmin
    .from("registrations")
    .select(REGISTRATION_COLUMNS)
    .eq("id", id)
    .maybeSingle<RegistrationRow>();
  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!registration) {
    return NextResponse.json({ error: "Registration not found." }, { status: 404 });
  }
  if (registration.claimed_patient_id) {
    return NextResponse.json({ error: "Already confirmed into a client record." }, { status: 400 });
  }

  const { data: patient, error: patientError } = await supabaseAdmin
    .from("patients")
    .select("id, photo_path")
    .ilike("email", registration.email)
    .maybeSingle<{ id: string; photo_path: string | null }>();
  if (patientError) {
    return NextResponse.json({ error: patientError.message }, { status: 500 });
  }
  if (!patient) {
    return NextResponse.json(
      { error: "No Athena Online account yet for that email. Ask them to finish setting up their account, or check back shortly." },
      { status: 409 }
    );
  }

  const applyError = await applyRegistration(registration, patient);
  if (applyError) return NextResponse.json({ error: applyError }, { status: 500 });

  return NextResponse.json({ ok: true, patientId: patient.id });
}
