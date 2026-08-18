import "server-only";
import { Resend } from "resend";
import { logCommunication } from "./communications";
import { getEmailTemplate, isTemplateSendable, renderTemplate, type EmailTemplateKey } from "./emailTemplates";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const OWNER_EMAIL = "athenaphysio@gmail.com";

// Every email in this file now sends via one shared path: fetch its
// template row (subject/body -- see 0072_email_templates.sql), refuse to
// send at all unless it's approved, substitute {{placeholders}}, wrap in
// the one shared layout below. Editing wording is a form on
// /clinic/vault/email-templates from here on, never a code change --
// and a template stuck on pending_review simply never sends, which is
// also Phase 1's kill switch for the three access-window emails: they
// seed pending_review, so fixing the CRON_SECRET auth gap doesn't also
// let three never-reviewed emails start firing.
async function sendTemplatedEmail(params: {
  templateKey: EmailTemplateKey;
  to: string;
  vars: Record<string, string>;
  ctaLabel: string;
  ctaUrl: string;
}): Promise<{ sent: boolean; reason?: string }> {
  if (!resend) throw new Error("RESEND_API_KEY is not configured.");
  const fromAddress = process.env.RESEND_FROM_ADDRESS;
  if (!fromAddress) throw new Error("RESEND_FROM_ADDRESS is not configured.");

  const template = await getEmailTemplate(params.templateKey);
  if (!template) return { sent: false, reason: `No email_templates row for "${params.templateKey}".` };
  if (!isTemplateSendable(template)) return { sent: false, reason: `"${params.templateKey}" is still pending review.` };

  const subject = renderTemplate(template.subject, params.vars);
  const body = renderTemplate(template.body, params.vars);

  const { error } = await resend.emails.send({
    from: fromAddress,
    to: params.to,
    subject,
    html: buildTemplatedEmailHtml(subject, body, params.ctaLabel, params.ctaUrl),
  });
  if (error) throw new Error(error.message);

  return { sent: true };
}

// One shared layout for every email this file sends -- an eyebrow, the
// template's own subject as the heading, its body as one or more
// paragraphs (split on blank lines), then one fixed CTA button. The
// button's label/link stay in code per email type, not editable here --
// only the words are.
function buildTemplatedEmailHtml(subject: string, body: string, ctaLabel: string, ctaUrl: string): string {
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="font-size:15px;line-height:1.6;color:#4A4540;margin:0 0 12px;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F2EDE4;font-family:-apple-system,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2EDE4;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;max-width:480px;">
            <tr>
              <td style="padding:36px 36px 8px;">
                <div style="font-size:12px;font-weight:600;letter-spacing:0.08em;color:#4A4540;text-transform:uppercase;">Athena Physio</div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 36px 0;">
                <h1 style="font-family: Georgia, 'Times New Roman', serif; font-weight:400; font-size:24px; color:#1C1C1C; margin:0;">${escapeHtml(subject)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 36px 28px;">
                ${paragraphs}
              </td>
            </tr>
            <tr>
              <td style="padding:0 36px 36px;">
                <a href="${ctaUrl}" style="display:inline-block;background:#9B1C1C;color:#ffffff;font-size:15px;font-weight:500;text-decoration:none;padding:13px 26px;border-radius:9px;">${escapeHtml(ctaLabel)}</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// They already have an account -- the clinic had to find them to attach
// the programme -- so this must open the sign-in tab, never sign-up,
// with their email pre-filled.
function signInUrl(to: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://athena-online-kappa.vercel.app";
  return `${appUrl}/start?mode=login&email=${encodeURIComponent(to)}`;
}

// Illustrative only -- a test send's CTA doesn't need to resolve to a
// real record, just show David roughly where the button goes. Deliberately
// separate from each real send function's own ctaUrl construction, which
// stays keyed to the real patient/programme in question.
const TEST_CTA_BY_KEY: Record<EmailTemplateKey, { label: string; url: string }> = {
  programme_ready: { label: "Open my programme", url: signInUrl("jenn@example.com") },
  membership_ready: { label: "Open the app", url: signInUrl("jenn@example.com") },
  programme_owned: { label: "Open the app", url: signInUrl("jenn@example.com") },
  new_message_alert: { label: "Open the conversation", url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://athena-online-kappa.vercel.app"}/clinic` },
  new_registration_alert: {
    label: "Review registration",
    url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://athena-online-kappa.vercel.app"}/clinic/registrations`,
  },
  access_window_warning: { label: "View plans", url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://athena-online-kappa.vercel.app"}/membership` },
  access_window_closed: {
    label: "View plans to continue",
    url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://athena-online-kappa.vercel.app"}/membership`,
  },
  access_window_followup: { label: "View plans", url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://athena-online-kappa.vercel.app"}/membership` },
};

// Phase 5's "send me a test" button -- always sends regardless of
// pending_review/approved status (that's the whole point: David needs
// to be able to preview a template before approving it, not after), and
// always to whoever asks for it, never a real patient. subject/body are
// whatever's currently in the form, saved or not, with sample values
// already substituted by the caller -- this function doesn't touch the
// database at all.
export async function sendTestEmail(key: EmailTemplateKey, subject: string, body: string, to: string): Promise<void> {
  if (!resend) throw new Error("RESEND_API_KEY is not configured.");
  const fromAddress = process.env.RESEND_FROM_ADDRESS;
  if (!fromAddress) throw new Error("RESEND_FROM_ADDRESS is not configured.");

  const cta = TEST_CTA_BY_KEY[key];
  const { error } = await resend.emails.send({
    from: fromAddress,
    to,
    subject: `[TEST] ${subject}`,
    html: buildTemplatedEmailHtml(subject, body, cta.label, cta.url),
  });
  if (error) throw new Error(error.message);
}

export async function sendProgrammeReadyEmail(patientId: string, to: string, firstName: string): Promise<void> {
  const result = await sendTemplatedEmail({
    templateKey: "programme_ready",
    to,
    vars: { first_name: firstName },
    ctaLabel: "Open my programme",
    ctaUrl: signInUrl(to),
  });
  if (!result.sent) return;

  await logCommunication({ patientId, channel: "email", type: "programme_ready", title: "Your programme's ready" });
}

// Same shape as sendProgrammeReadyEmail above, for a membership signup
// (subscription or upfront) instead of a programme.
export async function sendMembershipReadyEmail(
  patientId: string,
  to: string,
  firstName: string,
  tierName: string
): Promise<void> {
  const result = await sendTemplatedEmail({
    templateKey: "membership_ready",
    to,
    vars: { first_name: firstName, tier_name: tierName },
    ctaLabel: "Open the app",
    ctaUrl: signInUrl(to),
  });
  if (!result.sent) return;

  await logCommunication({ patientId, channel: "email", type: "membership_ready", title: "You're set up" });
}

// Same shape as sendProgrammeReadyEmail above, for buying an existing
// programme outright instead of receiving a new one.
export async function sendProgrammeOwnedEmail(
  patientId: string,
  to: string,
  firstName: string,
  programmeTitle: string
): Promise<void> {
  const result = await sendTemplatedEmail({
    templateKey: "programme_owned",
    to,
    vars: { first_name: firstName, programme_title: programmeTitle },
    ctaLabel: "Open the app",
    ctaUrl: signInUrl(to),
  });
  if (!result.sent) return;

  await logCommunication({ patientId, channel: "email", type: "programme_owned", title: "Yours to keep" });
}

// Sent 7 days before a programme's access window closes -- a real chance
// to convert before the cliff-edge, not a surprise on the day. Skipped
// entirely for a null access_window_weeks or an active membership --
// see the daily query in src/app/api/cron/access-window-emails/route.ts,
// which excludes both before this is ever called -- and skipped again
// here if the template itself isn't approved yet.
export async function sendAccessWindowWarningEmail(
  patientId: string,
  to: string,
  firstName: string,
  endDateLabel: string,
  sessionsCompleted: number
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://athena-online-kappa.vercel.app";
  const result = await sendTemplatedEmail({
    templateKey: "access_window_warning",
    to,
    vars: {
      patient_first_name: firstName,
      end_date: endDateLabel,
      sessions_completed: String(sessionsCompleted),
    },
    ctaLabel: "View plans",
    ctaUrl: `${appUrl}/membership`,
  });
  if (!result.sent) return;

  await logCommunication({
    patientId,
    channel: "email",
    type: "access_window_warning",
    title: "Your programme access ends in a week",
  });
}

// Sent the day a programme's access window closes -- matches the in-app
// locked state (ProgrammeClosedCard) going live at the same time.
export async function sendAccessWindowClosedEmail(
  patientId: string,
  to: string,
  firstName: string,
  sessionsCompleted: number
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://athena-online-kappa.vercel.app";
  const result = await sendTemplatedEmail({
    templateKey: "access_window_closed",
    to,
    vars: { patient_first_name: firstName, sessions_completed: String(sessionsCompleted) },
    ctaLabel: "View plans to continue",
    ctaUrl: `${appUrl}/membership`,
  });
  if (!result.sent) return;

  await logCommunication({ patientId, channel: "email", type: "access_window_closed", title: "Your programme has ended" });
}

// One light-touch follow-up only, a few days after closing, for anyone
// who still hasn't converted -- not a repeating drip sequence. Skipped
// the moment an active membership exists at check time, same as the
// other two.
export async function sendAccessWindowFollowupEmail(patientId: string, to: string, firstName: string): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://athena-online-kappa.vercel.app";
  const result = await sendTemplatedEmail({
    templateKey: "access_window_followup",
    to,
    vars: { patient_first_name: firstName },
    ctaLabel: "View plans",
    ctaUrl: `${appUrl}/membership`,
  });
  if (!result.sent) return;

  await logCommunication({
    patientId,
    channel: "email",
    type: "access_window_followup",
    title: "Access window follow-up sent",
  });
}

// Alerts David when a real message reaches him -- a patient's free
// message, or any message from a patient on an active paid tier. Never
// called for a gated (blocked) message; see src/lib/messaging.ts, where
// that branch returns before this is ever reached. Logged against the
// patient's own Communications record too, same discipline as every other
// email in this file -- not something sent to the patient, but a record of
// what fired for them is still worth having, especially since every
// silent-failure bug found this session started as an unlogged, unchecked
// send.
export async function sendNewMessageAlertEmail(patientName: string, preview: string, patientId: string): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://athena-online-kappa.vercel.app";
  const inboxLink = `${appUrl}/clinic/patients/${patientId}/dashboard`;
  const result = await sendTemplatedEmail({
    templateKey: "new_message_alert",
    to: OWNER_EMAIL,
    vars: { patient_name: patientName, message_preview: preview, inbox_link: inboxLink },
    ctaLabel: "Open the conversation",
    ctaUrl: inboxLink,
  });
  if (!result.sent) return;

  await logCommunication({
    patientId,
    channel: "email",
    type: "new_message_alert",
    title: `Message alert sent for ${patientName}`,
  });
}

// Alerts David the moment someone submits /register (Phase 5 of
// the registration brief). No patientId to log against yet -- this fires
// before any Athena Online account exists, so unlike every other email
// in this file it doesn't call logCommunication (that log is a patient's
// own Communications record, and there's no patient here yet).
export async function sendNewRegistrationAlertEmail(
  patientName: string,
  contactEmail: string,
  contactPhone: string | null,
  submittedAtIso: string
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://athena-online-kappa.vercel.app";
  const submittedAtLabel = new Date(submittedAtIso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  await sendTemplatedEmail({
    templateKey: "new_registration_alert",
    to: OWNER_EMAIL,
    vars: {
      patient_name: patientName,
      submitted_at: submittedAtLabel,
      email: contactEmail,
      phone: contactPhone || "not given",
      review_link: `${appUrl}/clinic/registrations`,
    },
    ctaLabel: "Review registration",
    ctaUrl: `${appUrl}/clinic/registrations`,
  });
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
