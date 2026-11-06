import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fileHeldLinkIntakes } from "@/lib/linkIntake";

export type RegistrationRow = {
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
  photo_path: string | null;
};

export const REGISTRATION_COLUMNS =
  "id, claimed_patient_id, title, first_name, last_name, preferred_name, date_of_birth, gender, occupation, referral_source, gp_name, gp_practice, email, mobile_phone, address, city, postcode, newsletter_opt_in, emergency_contact_name, emergency_contact_phone, is_guardian_submission, guardian_full_name, guardian_relationship, guardian_relationship_other, privacy_policy_accepted_at, notes_policy_accepted_at, cancellation_policy_accepted_at, treatment_consent_signed_name, treatment_consent_signed_at, photo_path";

// Copies every answer from a registration onto the client's record and
// marks the registration as confirmed into it. Used by Confirm on the
// Registrations page and by Approve on the Clients list.
export async function applyRegistration(
  registration: RegistrationRow,
  patient: { id: string; photo_path: string | null }
): Promise<string | null> {
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
      // A headshot from the form is used only if the clinic has not
      // already added one.
      ...(registration.photo_path && !patient.photo_path ? { photo_path: registration.photo_path } : {}),
    })
    .eq("id", patient.id);
  if (updateError) {
    return updateError.message;
  }

  const { error: claimError } = await supabaseAdmin
    .from("registrations")
    .update({ claimed_patient_id: patient.id, reviewed_at: new Date().toISOString() })
    .eq("id", registration.id);
  if (claimError) {
    return claimError.message;
  }

  // A Programme intake form they filled in from a link before they were in
  // the app is filed into their record now, with the rest of their details.
  try {
    await fileHeldLinkIntakes(patient.id, registration.email);
  } catch (err) {
    console.error("filing held link intake forms failed", err);
  }

  return null;
}

// The newest unconfirmed registration made with this email, if any.
export async function findOpenRegistration(email: string): Promise<RegistrationRow | null> {
  const { data } = await supabaseAdmin
    .from("registrations")
    .select(REGISTRATION_COLUMNS)
    .ilike("email", email)
    .is("claimed_patient_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<RegistrationRow>();
  return data ?? null;
}
