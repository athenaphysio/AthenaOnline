import { supabaseAdmin } from "@/lib/supabaseAdmin";
import styles from "../../clinic.module.css";
import ClinicBrandbar from "../../ClinicBrandbar";
import EmailTemplateForm, { type EmailTemplateRow } from "./EmailTemplateForm";

export const dynamic = "force-dynamic";

// Every automated email the platform can send, one real editable row
// each -- see 0072_email_templates.sql and the Phase 2 brief. Ordered
// with anything still pending review first, since that's the thing most
// likely to need David's attention today.
export default async function EmailTemplatesPage() {
  const { data } = await supabaseAdmin
    .from("email_templates")
    .select("key, name, subject, body, status, grandfathered, updated_at, updated_by")
    .returns<EmailTemplateRow[]>();

  const templates = (data ?? []).slice().sort((a, b) => {
    if (a.status !== b.status) return a.status === "pending_review" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  const pendingCount = templates.filter((t) => t.status === "pending_review").length;

  return (
    <div className={styles.app}>
      <div className={styles.inner}>
        <ClinicBrandbar />

        <h1 className={styles.heading}>Email templates</h1>
        <p className={styles.subheading}>
          Every automated email, in one place. {pendingCount > 0 ? `${pendingCount} pending review.` : "All approved."}
        </p>

        {templates.map((template) => (
          <EmailTemplateForm key={template.key} template={template} />
        ))}
      </div>
    </div>
  );
}
