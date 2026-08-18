import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type EmailTemplateKey =
  | "programme_ready"
  | "membership_ready"
  | "programme_owned"
  | "new_message_alert"
  | "new_registration_alert"
  | "access_window_warning"
  | "access_window_closed"
  | "access_window_followup";

export type EmailTemplate = {
  key: string;
  name: string;
  subject: string;
  body: string;
  status: "pending_review" | "approved";
  grandfathered: boolean;
  updated_at: string;
  updated_by: string | null;
};

// The one place every send function in email.ts reads its wording from --
// see the Phase 2 brief (0072_email_templates.sql). Nothing here ever
// falls back to a hardcoded string: if a template row is missing, the
// send function has nothing to send and must not send it, same as an
// unapproved one.
export async function getEmailTemplate(key: EmailTemplateKey): Promise<EmailTemplate | null> {
  const { data, error } = await supabaseAdmin.from("email_templates").select("*").eq("key", key).maybeSingle<EmailTemplate>();
  if (error) throw new Error(error.message);
  return data;
}

// Phase 1's kill switch, in its permanent form: a send function calls
// this before ever calling Resend. A pending_review template blocks the
// send entirely -- not a warning, not a lower-priority queue, simply
// never sent -- until David flips it to approved from
// /clinic/vault/email-templates. The one exception is grandfathered:
// true means this template was migrated in from code that was already
// live and working (Phase 3) -- pending_review still shows David it
// needs a real look, but it must not interrupt something that already
// worked. Anything freshly pending_review with grandfathered = false
// (every new template starts this way) gets the real hard gate (Phase
// 4) -- genuinely unable to send until approved.
export function isTemplateSendable(template: EmailTemplate | null): boolean {
  if (!template) return false;
  return template.status === "approved" || template.grandfathered;
}

// {{first_name}} -> vars.first_name, case-sensitive, left untouched if no
// matching var was supplied (surfaces a mistyped placeholder rather than
// silently swallowing it into an empty string).
export function renderTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => (key in vars ? vars[key] : match));
}

// Fill-in values for the Phase 5 "send me a test" button -- a real send
// substitutes real per-patient data; a test substitutes these instead,
// so a template with unfamiliar placeholders still renders as readable
// prose rather than showing "{{first_name}}" literally in David's inbox.
export const SAMPLE_VARS_BY_KEY: Record<EmailTemplateKey, Record<string, string>> = {
  programme_ready: { first_name: "Jenn" },
  membership_ready: { first_name: "Jenn", tier_name: "Athena Progress" },
  programme_owned: { first_name: "Jenn", programme_title: "8-Week Return to Running" },
  new_message_alert: {
    patient_name: "Jenn Silver",
    message_preview: "Hi David, quick question about today's session.",
    inbox_link: "https://athena-online-kappa.vercel.app/clinic",
  },
  new_registration_alert: {
    patient_name: "Jenn Silver",
    submitted_at: "15 Aug 2026, 14:32",
    email: "jenn@example.com",
    phone: "07700 900000",
    review_link: "https://athena-online-kappa.vercel.app/clinic/registrations",
  },
  access_window_warning: {
    patient_first_name: "Jenn",
    end_date: "22 Aug 2026",
    sessions_completed: "12",
    tier_link: "https://athena-online-kappa.vercel.app/membership",
  },
  access_window_closed: {
    patient_first_name: "Jenn",
    sessions_completed: "12",
    tier_link: "https://athena-online-kappa.vercel.app/membership",
  },
  access_window_followup: { patient_first_name: "Jenn", tier_link: "https://athena-online-kappa.vercel.app/membership" },
};
