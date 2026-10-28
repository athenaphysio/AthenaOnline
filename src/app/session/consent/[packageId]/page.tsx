import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { consentFingerprint, consentStatus } from "@/lib/clinicianAccess";
import { sectionLabel } from "@/lib/clinicianAccessSections";
import sessionStyles from "../../TodaySession.module.css";
import styles from "@/components/passport/Passport.module.css";
import ConsentForm from "./ConsentForm";

// The client reads who is on their care team and what each person can see,
// then signs, or withdraws a consent they gave before.
export default async function ConsentPage({ params }: { params: Promise<{ packageId: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/start");

  const { packageId } = await params;
  const { data: membership } = await supabaseAdmin
    .from("patient_packages")
    .select("packages(name)")
    .eq("patient_id", user.id)
    .eq("package_id", packageId)
    .maybeSingle<{ packages: { name: string } | null }>();
  if (!membership) notFound();

  const status = await consentStatus(user.id, packageId);
  if (status.state === "no_wording") notFound();
  const packageName = membership.packages?.name ?? "your programme";
  const showing = status.state === "signed" ? status.consent.clinicians : status.clinicians;
  const firstName = (user.user_metadata?.first_name as string | undefined) ?? "";

  return (
    <div className={sessionStyles.app}>
      <div className={sessionStyles.inner}>
        <div className={styles.wrap}>
          <Link href="/session" className={styles.back}>
            ‹ Back
          </Link>
          <div className={styles.eyebrow} style={{ marginTop: 8 }}>
            {packageName}, version {status.version.version}
          </div>
          <h1 className={styles.title}>Your care team and your information</h1>

          {status.state === "needs_resign" && (
            <div className={styles.section} style={{ borderColor: "#b45309", marginTop: 16 }}>
              <p className={styles.sectionBody}>
                {status.reason} Please read the page again and sign if you are happy. Until you do, nobody new can see anything.
              </p>
            </div>
          )}
          {status.state === "withdrawn" && (
            <div className={styles.section} style={{ marginTop: 16 }}>
              <p className={styles.sectionBody}>
                You withdrew your consent, so nobody on the care team can see your information through the app. You can sign
                again below at any time if you change your mind.
              </p>
            </div>
          )}

          <div className={styles.section} style={{ marginTop: 16 }}>
            {status.version.body.split(/\n\s*\n/).map((para, i) => (
              <p key={i} className={styles.sectionBody} style={{ marginBottom: 12, whiteSpace: "pre-wrap" }}>
                {para.trim()}
              </p>
            ))}
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Who can see what</div>
            {showing.length === 0 && <p className={styles.sectionBody}>Nobody has been given access yet.</p>}
            {showing.map((c) => (
              <div key={c.staff_id} style={{ padding: "10px 0", borderTop: "1px solid #efe9de" }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{c.name}</div>
                {c.profession && <div style={{ fontSize: 13, color: "var(--muted)" }}>{c.profession}</div>}
                <div style={{ fontSize: 13.5, marginTop: 4, lineHeight: 1.5 }}>
                  {c.sections.filter((s) => s !== "write_notes").map(sectionLabel).join(", ")}
                  {c.sections.includes("write_notes") && ". Can add notes for the care team"}
                </div>
              </div>
            ))}
          </div>

          <ConsentForm
            packageId={packageId}
            state={status.state}
            fingerprint={consentFingerprint(status.version.id, status.clinicians)}
            signedLine={
              status.state === "signed"
                ? `Signed by ${status.consent.signed_name} on ${new Date(status.consent.signed_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.`
                : null
            }
            suggestedName={firstName}
          />
        </div>
      </div>
    </div>
  );
}
