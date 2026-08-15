import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import styles from "../clinic.module.css";
import ClinicBrandbar from "../ClinicBrandbar";
import MarkReviewedButton from "./MarkReviewedButton";
import ConfirmRegistrationButton from "./ConfirmRegistrationButton";

export const dynamic = "force-dynamic";

type RegistrationRow = {
  id: string;
  created_at: string;
  reviewed_at: string | null;
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
  treatment_consent_signed_name: string | null;
  treatment_consent_signed_at: string | null;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function ageFrom(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const hasHadBirthdayThisYear =
    now.getMonth() > dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() >= dob.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

// Every /register submission lands here for review -- nothing is
// merged into a real patients row automatically until David confirms it
// (see the Phase 2 brief); this is purely "what came in, and has David
// seen it".
export default async function RegistrationsPage() {
  const { data } = await supabaseAdmin
    .from("registrations")
    .select(
      "id, created_at, reviewed_at, claimed_patient_id, title, first_name, last_name, preferred_name, date_of_birth, gender, occupation, referral_source, gp_name, gp_practice, email, mobile_phone, address, city, postcode, newsletter_opt_in, emergency_contact_name, emergency_contact_phone, is_guardian_submission, guardian_full_name, guardian_relationship, guardian_relationship_other, treatment_consent_signed_name, treatment_consent_signed_at"
    )
    .order("created_at", { ascending: false })
    .returns<RegistrationRow[]>();

  const registrations = data ?? [];
  const newCount = registrations.filter((r) => !r.reviewed_at).length;

  // An account made from this same email usually already exists by the
  // time David looks at this list -- the patient's own /start signup
  // happens immediately after submitting (Phase 6) -- so this is looked
  // up once here rather than making the confirm button guess blind.
  // Matched case-insensitively (same as the confirm route itself), so
  // a small patient list is fetched in full rather than trying to build
  // a case-insensitive IN clause.
  const { data: allPatients } = await supabaseAdmin.from("patients").select("id, email").returns<{ id: string; email: string }[]>();
  const patientIdByEmail = new Map((allPatients ?? []).map((p) => [p.email.toLowerCase(), p.id]));

  return (
    <div className={styles.app}>
      <div className={styles.inner}>
        <ClinicBrandbar />

        <h1 className={styles.heading}>Registrations</h1>
        <p className={styles.subheading}>
          Submissions from the public registration form.{" "}
          {newCount > 0 ? `${newCount} not yet reviewed.` : "All caught up."}{" "}
          <Link href="/clinic/tools" className={styles.canvasLink}>
            ← Tools
          </Link>
        </p>

        {registrations.length === 0 && (
          <p className={styles.notice} style={{ color: "var(--clinic-on-canvas-muted)" }}>
            Nothing submitted yet.
          </p>
        )}

        {registrations.map((r) => {
          const relationship =
            r.guardian_relationship === "Other" ? r.guardian_relationship_other || "Other" : r.guardian_relationship;
          const matchedPatientId = r.claimed_patient_id ?? patientIdByEmail.get(r.email.toLowerCase()) ?? null;
          return (
            <div key={r.id} className={styles.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 15 }}>
                    {r.title ? `${r.title} ` : ""}
                    {r.first_name} {r.last_name}
                    {r.preferred_name && <span style={{ color: "var(--muted)" }}> ({r.preferred_name})</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
                    {ageFrom(r.date_of_birth)} years old · {r.gender || "gender not given"} · submitted {formatDate(r.created_at)}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                  {r.is_guardian_submission && <span className={styles.statusPill}>Under 18</span>}
                  {r.claimed_patient_id ? (
                    <Link href={`/clinic/patients/${r.claimed_patient_id}`} className={styles.canvasLink} style={{ fontSize: 12.5 }}>
                      Confirmed → view patient
                    </Link>
                  ) : matchedPatientId ? (
                    <ConfirmRegistrationButton registrationId={r.id} />
                  ) : (
                    <>
                      <span style={{ fontSize: 11.5, color: "var(--muted)", textAlign: "right", maxWidth: 160 }}>
                        Waiting for them to finish account setup
                      </span>
                      {!r.reviewed_at && <MarkReviewedButton registrationId={r.id} />}
                    </>
                  )}
                  {r.reviewed_at && matchedPatientId === null && <span className={styles.statusPill}>Reviewed</span>}
                </div>
              </div>

              {r.is_guardian_submission && (
                <div style={{ fontSize: 13, marginTop: 10 }}>
                  <strong>Parent/guardian:</strong> {r.guardian_full_name} ({relationship})
                </div>
              )}

              <div style={{ fontSize: 13, marginTop: 10, lineHeight: 1.7 }}>
                <div>
                  <strong>Contact:</strong> {r.email}
                  {r.mobile_phone ? ` · ${r.mobile_phone}` : ""}
                </div>
                {(r.address || r.city || r.postcode) && (
                  <div>
                    <strong>Address:</strong> {[r.address, r.city, r.postcode].filter(Boolean).join(", ")}
                  </div>
                )}
                {r.occupation && (
                  <div>
                    <strong>{r.is_guardian_submission ? "School / year group:" : "Occupation:"}</strong> {r.occupation}
                  </div>
                )}
                {r.referral_source && (
                  <div>
                    <strong>Heard about us via:</strong> {r.referral_source}
                  </div>
                )}
                {(r.gp_name || r.gp_practice) && (
                  <div>
                    <strong>GP:</strong> {[r.gp_name, r.gp_practice].filter(Boolean).join(", ")}
                  </div>
                )}
                {(r.emergency_contact_name || r.emergency_contact_phone) && (
                  <div>
                    <strong>Emergency contact:</strong> {[r.emergency_contact_name, r.emergency_contact_phone].filter(Boolean).join(", ")}
                  </div>
                )}
                {r.newsletter_opt_in && <div>Opted in to the newsletter.</div>}
                {r.treatment_consent_signed_name && r.treatment_consent_signed_at && (
                  <div>
                    <strong>Signed:</strong> {r.treatment_consent_signed_name} on {formatDate(r.treatment_consent_signed_at)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
