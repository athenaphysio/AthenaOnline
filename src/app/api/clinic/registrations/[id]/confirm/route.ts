import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RegistrationRow = {
  id: string;
  claimed_patient_id: string | null;
  title: string | null;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  date_of_birth: string;
  gender: string | null;
  occupation: string | null;
  referral_source: string | null;
  gp_name: string | null;
  gp_practice: string | null;
  email: string;
  mobile_phone: string | null;
  address: string | null;
  city: string | null;
  postcode: string | null;
  newsletter_opt_in: boolean;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  is_guardian_submission: boolean;
  guardian_full_name: string | null;
  guardian_relationship: string | null;
  guardian_relationship_other: string | null;
  privacy_policy_accepted_at: string | null;
  notes_policy_accepted_at: string | null;
  cancellation_policy_accepted_at: string | null;
  treatment_consent_signed_name: string | null;
  treatment_consent_signed_at: string | null;
};

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
    .select(
      "id, claimed_patient_id, title, first_name, last_name, preferred_name, date_of_birth, gender, occupation, referral_source, gp_name, gp_practice, email, mobile_phone, address, city, postcode, newsletter_opt_in, emergency_contact_name, emergency_contact_phone, is_guardian_submission, guardian_full_name, guardian_relationship, guardian_relationship_other, privacy_policy_accepted_at, notes_policy_accepted_at, cancellation_policy_accepted_at, treatment_consent_signed_name, treatment_consent_signed_at"
    )
    .eq("id", id)
    .maybeSingle<RegistrationRow>();
  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!registration) {
    return NextResponse.json({ error: "Registration not found." }, { status: 404 });
  }
  if (registration.claimed_patient_id) {
    return NextResponse.json({ error: "Already confirmed into a patient record." }, { status: 400 });
  }

  const { data: patient, error: patientError } = await supabaseAdmin
    .from("patients")
    .select("id")
    .ilike("email", registration.email)
    .maybeSingle<{ id: string }>();
  if (patientError) {
    return NextResponse.json({ error: patientError.message }, { status: 500 });
  }
  if (!patient) {
    return NextResponse.json(
      { error: "No Athena Online account yet for that email. Ask them to finish setting up their account, or check back shortly." },
      { status: 409 }
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from("patients")
    .update({
      title: registration.title,
      first_name: registration.first_name,
      last_name: registration.last_name,
      preferred_name: registration.preferred_name,
      date_of_birth: registration.date_of_birth,
      gender: registration.gender,
      occupation: registration.occupation,
      referral_source: registration.referral_source,
      gp_name: registration.gp_name,
      gp_practice: registration.gp_practice,
      email: registration.email,
      mobile_phone: registration.mobile_phone,
      address: registration.address,
      city: registration.city,
      postcode: registration.postcode,
      newsletter_opt_in: registration.newsletter_opt_in,
      emergency_contact_name: registration.emergency_contact_name,
      emergency_contact_phone: registration.emergency_contact_phone,
      is_guardian_account: registration.is_guardian_submission,
      guardian_full_name: registration.guardian_full_name,
      guardian_relationship: registration.guardian_relationship,
      guardian_relationship_other: registration.guardian_relationship_other,
      privacy_policy_accepted_at: registration.privacy_policy_accepted_at,
      notes_policy_accepted_at: registration.notes_policy_accepted_at,
      cancellation_policy_accepted_at: registration.cancellation_policy_accepted_at,
      treatment_consent_signed_name: registration.treatment_consent_signed_name,
      treatment_consent_signed_at: registration.treatment_consent_signed_at,
    })
    .eq("id", patient.id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const { error: claimError } = await supabaseAdmin
    .from("registrations")
    .update({ claimed_patient_id: patient.id, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (claimError) {
    return NextResponse.json({ error: claimError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, patientId: patient.id });
}
