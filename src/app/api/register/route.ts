import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendNewRegistrationAlertEmail } from "@/lib/email";

type RegisterBody = {
  title?: string;
  first_name?: string;
  last_name?: string;
  preferred_name?: string;
  date_of_birth?: string;
  gender?: string;
  occupation?: string;
  referral_source?: string;
  gp_name?: string;
  gp_practice?: string;
  email?: string;
  mobile_phone?: string;
  address?: string;
  city?: string;
  postcode?: string;
  newsletter_opt_in?: boolean;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  guardian_full_name?: string;
  guardian_relationship?: string;
  guardian_relationship_other?: string;
  privacy_policy_accepted?: boolean;
  notes_policy_accepted?: boolean;
  cancellation_policy_accepted?: boolean;
  treatment_consent_signed_name?: string;
};

// Whether the form should have been in guardian mode is decided here
// server-side from the date of birth itself, never trusted from the
// client's own branching state -- which consent wording legally applied
// depends on this.
function isUnder18(dateOfBirth: string, asOf: Date = new Date()): boolean {
  const dob = new Date(dateOfBirth);
  let age = asOf.getFullYear() - dob.getFullYear();
  const hasHadBirthdayThisYear =
    asOf.getMonth() > dob.getMonth() || (asOf.getMonth() === dob.getMonth() && asOf.getDate() >= dob.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age < 18;
}

// Public, unauthenticated -- this is the whole point of the route. No
// session, no patient_id to trust; every field is exactly what the
// submitter typed. Validated here, then stored as a pending registration
// for David to review (see 0068_registrations.sql) -- never written
// straight into patients.
export async function POST(request: NextRequest) {
  const body = (await request.json()) as RegisterBody;

  const firstName = body.first_name?.trim();
  const lastName = body.last_name?.trim();
  const dateOfBirth = body.date_of_birth?.trim();
  const email = body.email?.trim();

  if (!firstName || !lastName || !dateOfBirth || !email) {
    return NextResponse.json({ error: "First name, last name, date of birth and email are required." }, { status: 400 });
  }
  if (Number.isNaN(new Date(dateOfBirth).getTime())) {
    return NextResponse.json({ error: "That date of birth isn't valid." }, { status: 400 });
  }
  if (!body.privacy_policy_accepted || !body.notes_policy_accepted || !body.cancellation_policy_accepted) {
    return NextResponse.json({ error: "Please accept all three policy items before submitting." }, { status: 400 });
  }
  const signedName = body.treatment_consent_signed_name?.trim();
  if (!signedName) {
    return NextResponse.json({ error: "Please type a full name to sign the treatment consent." }, { status: 400 });
  }

  const guardianSubmission = isUnder18(dateOfBirth);
  if (guardianSubmission) {
    if (!body.guardian_full_name?.trim() || !body.guardian_relationship) {
      return NextResponse.json({ error: "Parent/guardian name and relationship are required." }, { status: 400 });
    }
    if (body.guardian_relationship === "Other" && !body.guardian_relationship_other?.trim()) {
      return NextResponse.json({ error: "Please specify the guardian's relationship to the child." }, { status: 400 });
    }
  }

  const now = new Date().toISOString();

  try {
    const { data, error } = await supabaseAdmin
      .from("registrations")
      .insert({
        title: guardianSubmission ? null : body.title || null,
        first_name: firstName,
        last_name: lastName,
        preferred_name: body.preferred_name?.trim() || null,
        date_of_birth: dateOfBirth,
        gender: body.gender || null,
        occupation: body.occupation?.trim() || null,
        referral_source: body.referral_source || null,
        gp_name: body.gp_name?.trim() || null,
        gp_practice: body.gp_practice?.trim() || null,
        email,
        mobile_phone: body.mobile_phone?.trim() || null,
        address: body.address?.trim() || null,
        city: body.city?.trim() || null,
        postcode: body.postcode?.trim() || null,
        newsletter_opt_in: !guardianSubmission && !!body.newsletter_opt_in,
        emergency_contact_name: body.emergency_contact_name?.trim() || null,
        emergency_contact_phone: body.emergency_contact_phone?.trim() || null,
        is_guardian_submission: guardianSubmission,
        guardian_full_name: guardianSubmission ? body.guardian_full_name?.trim() || null : null,
        guardian_relationship: guardianSubmission ? body.guardian_relationship || null : null,
        guardian_relationship_other:
          guardianSubmission && body.guardian_relationship === "Other" ? body.guardian_relationship_other?.trim() || null : null,
        privacy_policy_accepted_at: now,
        notes_policy_accepted_at: now,
        cancellation_policy_accepted_at: now,
        treatment_consent_signed_name: signedName,
        treatment_consent_signed_at: now,
      })
      .select("id")
      .single<{ id: string }>();
    if (error) throw new Error(error.message);

    // Best-effort -- a missing alert never blocks the submission itself;
    // the registration still shows up next time David opens the review
    // page. See Phase 5 of the brief.
    try {
      await sendNewRegistrationAlertEmail(`${firstName} ${lastName}`, email, body.mobile_phone?.trim() || null, now);
    } catch (alertErr) {
      console.error("registration alert email failed", alertErr);
    }

    return NextResponse.json({ id: data.id });
  } catch (err) {
    console.error("registration submit failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Couldn't submit that: ${detail}` }, { status: 500 });
  }
}
