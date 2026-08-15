"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageBanner from "@/components/PageBanner";
import styles from "./Register.module.css";

const TITLE_OPTIONS = ["Mr", "Mrs", "Miss", "Ms", "Mx", "Dr", "Other"];
const GENDER_OPTIONS = ["Female", "Male", "Non-binary", "Prefer not to say", "Other"];
const REFERRAL_OPTIONS = [
  "Google search",
  "Instagram / social media",
  "Friend or family referral",
  "GP referral",
  "Walked past / saw the clinic",
  "Existing Athena patient",
  "Other",
];
const RELATIONSHIP_OPTIONS = ["Parent", "Legal guardian", "Other"];

// The real privacy policy page isn't live yet -- swap this for the real
// address once David has one published (see the Phase 3 brief). Left as
// a plain, visibly-a-placeholder bracket rather than a dead link.
const PRIVACY_POLICY_URL: string | null = null;

function isUnder18(dateOfBirth: string, asOf: Date = new Date()): boolean {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return false;
  let age = asOf.getFullYear() - dob.getFullYear();
  const hasHadBirthdayThisYear =
    asOf.getMonth() > dob.getMonth() || (asOf.getMonth() === dob.getMonth() && asOf.getDate() >= dob.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age < 18;
}

export default function RegisterPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [occupation, setOccupation] = useState("");
  const [referralSource, setReferralSource] = useState("");

  const [gpName, setGpName] = useState("");
  const [gpPractice, setGpPractice] = useState("");

  const [email, setEmail] = useState("");
  const [mobilePhone, setMobilePhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postcode, setPostcode] = useState("");
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);

  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");

  const [guardianFullName, setGuardianFullName] = useState("");
  const [guardianRelationship, setGuardianRelationship] = useState("");
  const [guardianRelationshipOther, setGuardianRelationshipOther] = useState("");

  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [notesAccepted, setNotesAccepted] = useState(false);
  const [cancellationAccepted, setCancellationAccepted] = useState(false);
  const [signedName, setSignedName] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardianMode = useMemo(() => isUnder18(dateOfBirth), [dateOfBirth]);
  const childName = `${firstName || "the child"}${lastName ? ` ${lastName}` : ""}`.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim() || !dateOfBirth || !email.trim()) {
      setError("Please fill in the required fields before submitting.");
      return;
    }
    if (!privacyAccepted || !notesAccepted || !cancellationAccepted) {
      setError("Please accept all three policy items before submitting.");
      return;
    }
    if (!signedName.trim()) {
      setError("Please type a full name to sign the treatment consent.");
      return;
    }
    if (guardianMode && (!guardianFullName.trim() || !guardianRelationship)) {
      setError("Please fill in the parent/guardian details before submitting.");
      return;
    }
    if (guardianMode && guardianRelationship === "Other" && !guardianRelationshipOther.trim()) {
      setError("Please specify the guardian's relationship to the child.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          first_name: firstName,
          last_name: lastName,
          preferred_name: preferredName,
          date_of_birth: dateOfBirth,
          gender,
          occupation,
          referral_source: referralSource,
          gp_name: gpName,
          gp_practice: gpPractice,
          email,
          mobile_phone: mobilePhone,
          address,
          city,
          postcode,
          newsletter_opt_in: newsletterOptIn,
          emergency_contact_name: emergencyContactName,
          emergency_contact_phone: emergencyContactPhone,
          guardian_full_name: guardianFullName,
          guardian_relationship: guardianRelationship,
          guardian_relationship_other: guardianRelationshipOther,
          privacy_policy_accepted: privacyAccepted,
          notes_policy_accepted: notesAccepted,
          cancellation_policy_accepted: cancellationAccepted,
          treatment_consent_signed_name: signedName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed.");
      // Straight into account setup, no confirmation screen in between --
      // see Phase 6 of the brief. The email/first name carried through are
      // always the account-holder's own: in guardian mode those same
      // state variables already hold the child's name and the guardian's
      // email (see the field bindings below), which is exactly what the
      // new account should be created with.
      router.replace(`/start?email=${encodeURIComponent(email)}&first_name=${encodeURIComponent(firstName)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed.");
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.app}>
      <PageBanner />
      <div className={styles.inner}>
        <div className={styles.intro}>
          <div className={styles.introHeading}>Patient registration</div>
          <p className={styles.introSub}>Required details ahead of your appointment.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.section}>
            <div className={styles.row2}>
              {!guardianMode && (
                <div className={styles.field} style={{ flex: 1 }}>
                  <label htmlFor="title">Title</label>
                  <select id="title" value={title} onChange={(e) => setTitle(e.target.value)}>
                    <option value="">Select…</option>
                    {TITLE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className={styles.field} style={{ flex: guardianMode ? 1 : 2 }}>
                <label htmlFor="preferredName">{guardianMode ? "Child's preferred name" : "Preferred name"}</label>
                <input
                  id="preferredName"
                  placeholder="e.g. Jenn"
                  value={preferredName}
                  onChange={(e) => setPreferredName(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="firstName">{guardianMode ? "Child's first name(s)" : "First name(s)"}</label>
              <input id="firstName" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>

            <div className={styles.field}>
              <label htmlFor="lastName">{guardianMode ? "Child's last name" : "Last name"}</label>
              <input id="lastName" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>

            <div className={styles.row2}>
              <div className={styles.field}>
                <label htmlFor="dob">{guardianMode ? "Child's date of birth" : "Date of birth"}</label>
                <input
                  id="dob"
                  type="date"
                  required
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="gender">{guardianMode ? "Child's gender" : "Gender"}</label>
                <select id="gender" value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="">Select…</option>
                  {GENDER_OPTIONS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="occupation">{guardianMode ? "School / year group" : "Occupation"}</label>
              <input
                id="occupation"
                placeholder={guardianMode ? "e.g. Riverside Primary, Year 4" : "e.g. HR Coordinator"}
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="referral">How did you hear about Athena Physio?</label>
              <select id="referral" value={referralSource} onChange={(e) => setReferralSource(e.target.value)}>
                <option value="">Select…</option>
                {REFERRAL_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.divider} />

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Your GP</div>
            <div className={styles.field}>
              <label htmlFor="gpName">GP name (if known)</label>
              <input
                id="gpName"
                placeholder="e.g. Dr Patel, or leave blank"
                value={gpName}
                onChange={(e) => setGpName(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="gpPractice">GP practice &amp; location</label>
              <input
                id="gpPractice"
                placeholder="e.g. The Red Practice, Walton-on-Thames"
                value={gpPractice}
                onChange={(e) => setGpPractice(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.divider} />

          {guardianMode ? (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Parent / guardian details</div>
              <div className={styles.field}>
                <label htmlFor="guardianName">Your full name</label>
                <input
                  id="guardianName"
                  required
                  value={guardianFullName}
                  onChange={(e) => setGuardianFullName(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="guardianRelationship">Relationship to child</label>
                <select
                  id="guardianRelationship"
                  required
                  value={guardianRelationship}
                  onChange={(e) => setGuardianRelationship(e.target.value)}
                >
                  <option value="">Select…</option>
                  {RELATIONSHIP_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r === "Other" ? "Other (please specify)" : r}
                    </option>
                  ))}
                </select>
              </div>
              {guardianRelationship === "Other" && (
                <div className={styles.field}>
                  <label htmlFor="guardianRelationshipOther">Please specify</label>
                  <input
                    id="guardianRelationshipOther"
                    required
                    value={guardianRelationshipOther}
                    onChange={(e) => setGuardianRelationshipOther(e.target.value)}
                  />
                </div>
              )}
              <div className={styles.field}>
                <label htmlFor="guardianEmail">Your email address</label>
                <input
                  id="guardianEmail"
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="guardianMobile">Your mobile phone</label>
                <input
                  id="guardianMobile"
                  placeholder="07…"
                  value={mobilePhone}
                  onChange={(e) => setMobilePhone(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Contact details</div>
              <div className={styles.field}>
                <label htmlFor="email">Email address</label>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="mobile">Mobile phone</label>
                <input id="mobile" placeholder="07…" value={mobilePhone} onChange={(e) => setMobilePhone(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label htmlFor="address">Address</label>
                <input
                  id="address"
                  placeholder="House name/number and street"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <div className={styles.row2}>
                <div className={styles.field}>
                  <label htmlFor="city">City</label>
                  <input id="city" placeholder="Town or city" value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div className={styles.field}>
                  <label htmlFor="postcode">Postcode</label>
                  <input id="postcode" placeholder="KT11 …" value={postcode} onChange={(e) => setPostcode(e.target.value)} />
                </div>
              </div>
              <label className={styles.checkboxRow}>
                <input type="checkbox" checked={newsletterOptIn} onChange={(e) => setNewsletterOptIn(e.target.checked)} />
                <span>Happy to receive occasional newsletters from Athena Physio.</span>
              </label>
            </div>
          )}

          <div className={styles.divider} />

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Emergency contact</div>
            <div className={styles.field}>
              <label htmlFor="emergencyName">Name</label>
              <input
                id="emergencyName"
                placeholder="Full name"
                value={emergencyContactName}
                onChange={(e) => setEmergencyContactName(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="emergencyPhone">Phone number</label>
              <input
                id="emergencyPhone"
                placeholder="07…"
                value={emergencyContactPhone}
                onChange={(e) => setEmergencyContactPhone(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.divider} />

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Consent</div>

            <div className={styles.consentBox}>
              {guardianMode
                ? `As parent/legal guardian of ${childName}, we are required to collect and hold their medical records in accordance with UK Health Care Professions Council and GDPR standards to ensure their privacy is maintained. `
                : "We are required to collect and hold your medical records in accordance with UK Health Care Professions Council and GDPR standards to ensure your privacy is maintained. "}
              {PRIVACY_POLICY_URL ? (
                <>
                  Full policy available <a href={PRIVACY_POLICY_URL}>here</a>.
                </>
              ) : (
                "Full policy available at [link]."
              )}
            </div>
            <label className={styles.checkboxRow}>
              <input type="checkbox" required checked={privacyAccepted} onChange={(e) => setPrivacyAccepted(e.target.checked)} />
              <span>I accept the privacy policy above.</span>
            </label>

            <div className={styles.consentBox}>
              <span className={styles.consentBoxTitle}>How we keep notes</span>
              Athena Physio uses transcription-based note keeping: session notes are generated from a transcript.
            </div>
            <label className={styles.checkboxRow}>
              <input type="checkbox" required checked={notesAccepted} onChange={(e) => setNotesAccepted(e.target.checked)} />
              <span>I understand and accept how session notes are kept.</span>
            </label>

            <div className={styles.consentBox}>
              <span className={styles.consentBoxTitle}>Cancellation policy</span>
              Appointments cancelled or rescheduled with less than 24 hours&apos; notice will be charged in full. This
              also applies to missed appointments.
            </div>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                required
                checked={cancellationAccepted}
                onChange={(e) => setCancellationAccepted(e.target.checked)}
              />
              <span>I understand and accept the cancellation policy above.</span>
            </label>

            <div className={styles.consentBox}>
              <span className={styles.consentBoxTitle}>Treatment consent</span>
              {guardianMode
                ? `By typing your name below, you confirm you are the parent or legal guardian of ${childName} and are providing consent for their treatment at Athena Physio and the terms above.`
                : "By typing your name below, you're providing consent for treatment at Athena Physio and the terms above."}
            </div>
            <div className={styles.field}>
              <label htmlFor="signedName">
                {guardianMode ? "Type your full name to sign (parent/guardian)" : "Type your full name to sign"}
              </label>
              <input
                id="signedName"
                required
                placeholder={guardianMode ? "Parent or guardian's name" : "Jennifer Silver"}
                value={signedName}
                onChange={(e) => setSignedName(e.target.value)}
              />
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.footer}>
            <button type="submit" className={styles.submitButton} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit registration"}
            </button>
            <p className={styles.footerNote}>Your details go straight to Dr David Silver PhD at Athena Physio.</p>
          </div>
        </form>
      </div>
    </div>
  );
}
