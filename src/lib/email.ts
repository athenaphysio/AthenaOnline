import { generateProgrammePlanPdf } from "@/lib/importedPlanPdf";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import "server-only";
import { Resend } from "resend";
import { logCommunication } from "./communications";
import { getEmailTemplate, isTemplateSendable, renderTemplate, type EmailTemplateKey } from "./emailTemplates";
import { resolveBrandPack, type ResolvedBrandPack } from "./brandPackResolve";
import { APP_URL } from "@/lib/appUrl";

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
  /** Omitted for the two internal alert emails (new_message_alert,
   * new_registration_alert) -- those go to David himself, not a patient,
   * so they always keep the fixed Athena look regardless of whose
   * message or registration triggered them. Every patient-facing send
   * passes its own patientId through from its own first argument. */
  patientId?: string;
  /** Where a reply goes -- used by the invitation, which says "just reply". */
  replyTo?: string;
  /** A fixed paragraph added after the template's own words. */
  extraParagraph?: string;
  /** Files sent with the email, such as the client's plan as a PDF. */
  attachments?: { filename: string; content: Buffer }[];
}): Promise<{ sent: boolean; reason?: string }> {
  if (!resend) throw new Error("RESEND_API_KEY is not configured.");
  const fromAddress = process.env.RESEND_FROM_ADDRESS;
  if (!fromAddress) throw new Error("RESEND_FROM_ADDRESS is not configured.");

  const template = await getEmailTemplate(params.templateKey);
  if (!template) return { sent: false, reason: `No email_templates row for "${params.templateKey}".` };
  if (!isTemplateSendable(template)) return { sent: false, reason: `"${params.templateKey}" is still pending review.` };

  const subject = renderTemplate(template.subject, params.vars);
  const body = renderTemplate(template.body, params.vars) + (params.extraParagraph ? `\n\n${params.extraParagraph}` : "");
  const brand = params.patientId ? await resolveBrandPack({ patientId: params.patientId }) : undefined;

  const { error } = await resend.emails.send({
    from: fromAddress,
    to: params.to,
    ...(params.replyTo ? { replyTo: params.replyTo } : {}),
    ...(params.attachments && params.attachments.length > 0 ? { attachments: params.attachments } : {}),
    subject,
    html: buildTemplatedEmailHtml(subject, body, params.ctaLabel, params.ctaUrl, brand),
  });
  if (error) throw new Error(error.message);

  return { sent: true };
}

// One shared layout for every email this file sends -- an eyebrow, the
// template's own subject as the heading, its body as one or more
// paragraphs (split on blank lines), then one fixed CTA button. The
// button's label/link stay in code per email type, not editable here --
// only the words are.
// brand is undefined for the two internal alert emails (never resolved,
// see sendTemplatedEmail) and for a resolution that landed entirely on
// the default pack -- both cases render with the exact literal hex this
// always used, not a value copied from the (now-corrected-to-match)
// default pack row, so a future edit to that row can never accidentally
// change David's own internal-notification emails.
function buildTemplatedEmailHtml(subject: string, body: string, ctaLabel: string, ctaUrl: string, brand?: ResolvedBrandPack): string {
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="font-size:15px;line-height:1.6;color:#4A4540;margin:0 0 12px;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

  const useCustom = brand && !brand.isAllDefault;
  // A dark pack's background colour is its deep canvas, which suits the
  // app but not an email full of dark text, so emails stay on cream.
  const pageBg = useCustom && brand.theme !== "dark" ? brand.background_color : "#F2EDE4";
  const ctaColor = useCustom ? brand.accent_color : "#9B1C1C";
  const eyebrow =
    useCustom && brand.wordmark_url
      ? `<img src="${brand.wordmark_url}" alt="" height="20" style="display:block;height:20px;width:auto;" />`
      : `<div style="font-size:12px;font-weight:600;letter-spacing:0.08em;color:#4A4540;text-transform:uppercase;">Athena Physio</div>`;

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${pageBg};font-family:-apple-system,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${pageBg};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;max-width:480px;">
            <tr>
              <td style="padding:36px 36px 8px;">
                ${eyebrow}
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
                <a href="${ctaUrl}" style="display:inline-block;background:${ctaColor};color:#ffffff;font-size:15px;font-weight:500;text-decoration:none;padding:13px 26px;border-radius:9px;">${escapeHtml(ctaLabel)}</a>
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
  const appUrl = APP_URL;
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
  new_message_alert: { label: "Open the conversation", url: `${APP_URL}/clinic` },
  roam_message_alert: { label: "Open Roam Messenger", url: `${APP_URL}/roam-messenger` },
  new_registration_alert: {
    label: "Review registration",
    url: `${APP_URL}/clinic/registrations`,
  },
  access_window_warning: { label: "View plans", url: `${APP_URL}/membership` },
  access_window_closed: {
    label: "View plans to continue",
    url: `${APP_URL}/membership`,
  },
  client_invite: { label: "Set up my account", url: `${APP_URL}/start` },
  client_approved: { label: "Open the app", url: signInUrl("jenn@example.com") },
  access_window_followup: { label: "View plans", url: `${APP_URL}/membership` },
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

export async function sendProgrammeReadyEmail(patientId: string, to: string, firstName: string, programmeId?: string): Promise<void> {
  // A scheduled block goes out with the whole plan attached as a PDF, so
  // the client can see every week at once and reply to confirm it fits.
  // If the PDF cannot be made, the email still goes, just without it.
  let attachment: { filename: string; content: Buffer } | null = null;
  if (programmeId) {
    try {
      const { data: programme } = await supabaseAdmin
        .from("programmes")
        .select("delivery_mode")
        .eq("id", programmeId)
        .maybeSingle<{ delivery_mode: string }>();
      if (programme?.delivery_mode === "scheduled") {
        const pdf = await generateProgrammePlanPdf(programmeId, { askToConfirm: true });
        if (pdf) attachment = { filename: pdf.filename, content: pdf.buffer };
      }
    } catch (err) {
      console.error("plan PDF for programme ready email failed", err);
    }
  }

  const result = await sendTemplatedEmail({
    templateKey: "programme_ready",
    to,
    vars: { first_name: firstName },
    ctaLabel: "Open my programme",
    ctaUrl: signInUrl(to),
    patientId,
    ...(attachment
      ? {
          attachments: [attachment],
          replyTo: OWNER_EMAIL,
          extraParagraph:
            "Your whole block is attached as a PDF, so you can see every week at once. Have a look through it, then just reply to this email to let David know it fits your week, or what you would change.",
        }
      : {}),
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
    patientId,
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
    patientId,
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
  const appUrl = APP_URL;
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
    patientId,
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
  const appUrl = APP_URL;
  const result = await sendTemplatedEmail({
    templateKey: "access_window_closed",
    to,
    vars: { patient_first_name: firstName, sessions_completed: String(sessionsCompleted) },
    ctaLabel: "View plans to continue",
    ctaUrl: `${appUrl}/membership`,
    patientId,
  });
  if (!result.sent) return;

  await logCommunication({ patientId, channel: "email", type: "access_window_closed", title: "Your programme has ended" });
}

// One light-touch follow-up only, a few days after closing, for anyone
// who still hasn't converted -- not a repeating drip sequence. Skipped
// the moment an active membership exists at check time, same as the
// other two.
export async function sendAccessWindowFollowupEmail(patientId: string, to: string, firstName: string): Promise<void> {
  const appUrl = APP_URL;
  const result = await sendTemplatedEmail({
    templateKey: "access_window_followup",
    to,
    vars: { patient_first_name: firstName },
    ctaLabel: "View plans",
    ctaUrl: `${appUrl}/membership`,
    patientId,
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
  const appUrl = APP_URL;
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

// The Roam Messenger alert for a new ROAM client message. Unlike the
// standard alert above it carries no name and nothing from the message,
// because email sits outside the app's own protection; the button opens
// the conversation in Roam Messenger, behind Face ID.
export async function sendRoamMessageAlertEmail(patientId: string): Promise<void> {
  const link = `${APP_URL}/roam-messenger?c=${encodeURIComponent(patientId)}`;
  const result = await sendTemplatedEmail({
    templateKey: "roam_message_alert",
    to: OWNER_EMAIL,
    vars: {},
    ctaLabel: "Open Roam Messenger",
    ctaUrl: link,
  });
  if (!result.sent) return;
  await logCommunication({ patientId, channel: "email", type: "new_message_alert", title: "Roam Messenger alert sent" });
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
  const appUrl = APP_URL;
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

// The invitation: a friendly welcome with a button to choose a password.
// Returns whether it actually went out, so the caller can tell David and
// leave Resend invite available if it didn't.
export async function sendClientInviteEmail(
  patientId: string,
  to: string,
  firstName: string,
  setupUrl: string
): Promise<{ sent: boolean; reason?: string }> {
  // Named for the app the client will actually see (ROAM for a Regenerate
  // client), so the email is recognisable to them and not filed away as an
  // unfamiliar "Athena" message.
  const brand = await resolveBrandPack({ patientId });
  const appName = brand?.app_layout.app_name?.trim() || "Athena";
  const result = await sendTemplatedEmail({
    templateKey: "client_invite",
    to,
    vars: { first_name: firstName, app_name: appName },
    ctaLabel: "Set up my account",
    ctaUrl: setupUrl,
    patientId,
    replyTo: OWNER_EMAIL,
  });
  if (result.sent) {
    await logCommunication({ patientId, channel: "email", type: "client_invite", title: `Welcome to ${appName}` });
  }
  return result;
}

// The welcome for a client who created their own account, sent the moment
// David presses Approve. Without it they were never told the app had
// opened. Named for the app they will see (ROAM for a Regenerate client),
// like the invitation. Returns whether it went out, so Approve can say so.
export async function sendClientApprovedEmail(
  patientId: string,
  to: string,
  firstName: string
): Promise<{ sent: boolean; reason?: string }> {
  const brand = await resolveBrandPack({ patientId });
  const appName = brand?.app_layout.app_name?.trim() || "Athena";
  const result = await sendTemplatedEmail({
    templateKey: "client_approved",
    to,
    vars: { first_name: firstName, app_name: appName },
    ctaLabel: "Open the app",
    ctaUrl: signInUrl(to),
    patientId,
    replyTo: OWNER_EMAIL,
  });
  if (result.sent) {
    await logCommunication({ patientId, channel: "email", type: "client_approved", title: `Your ${appName} account is ready` });
  }
  return result;
}

// The six digit login code for a clinician on a new device. A security
// email, so it is sent directly rather than through the editable templates,
// and it can never be held back by a template awaiting review.
export async function sendClinicianLoginCodeEmail(to: string, name: string, code: string): Promise<void> {
  if (!resend) throw new Error("RESEND_API_KEY is not configured.");
  const fromAddress = process.env.RESEND_FROM_ADDRESS;
  if (!fromAddress) throw new Error("RESEND_FROM_ADDRESS is not configured.");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F2EDE4;font-family:-apple-system,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2EDE4;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;max-width:480px;">
          <tr><td style="padding:36px 36px 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#7A716A;">Athena Physio clinician login</td></tr>
          <tr><td style="padding:8px 36px 0;"><h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:24px;color:#1C1C1C;margin:0;">Your login code</h1></td></tr>
          <tr><td style="padding:16px 36px 8px;font-size:15px;line-height:1.6;color:#4A4540;">Hello ${escapeHtml(name || "there")}, enter this code to confirm it is you logging in on a new device. It works once and expires in 10 minutes.</td></tr>
          <tr><td style="padding:8px 36px 16px;"><div style="font-family:ui-monospace,Menlo,monospace;font-size:34px;letter-spacing:.3em;color:#1C1C1C;background:#F2EDE4;border-radius:10px;padding:14px 18px;display:inline-block;">${code}</div></td></tr>
          <tr><td style="padding:0 36px 36px;font-size:13px;line-height:1.6;color:#7A716A;">If you did not just try to log in, someone may know your password. Please tell Dr David Silver PhD straight away so it can be changed.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  const { error } = await resend.emails.send({
    from: fromAddress,
    to,
    subject: `${code} is your Athena login code`,
    html,
  });
  if (error) throw new Error(error.message);
}

// The welcome for a new clinician, sent the moment David creates their
// account on the Staff screen, and again from the Resend login email button.
// It carries the login page and the email address they log in with, and
// deliberately never the password, which David gives them separately.
// Sent directly, like the login code, so a template awaiting review can
// never hold it back. Returns whether it went out, so the screen can say so.
export async function sendClinicianWelcomeEmail(to: string, name: string): Promise<{ sent: boolean; reason?: string }> {
  if (!resend) return { sent: false, reason: "RESEND_API_KEY is not configured." };
  const fromAddress = process.env.RESEND_FROM_ADDRESS;
  if (!fromAddress) return { sent: false, reason: "RESEND_FROM_ADDRESS is not configured." };

  const loginUrl = `${APP_URL}/coach/login`;
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F2EDE4;font-family:-apple-system,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2EDE4;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;max-width:480px;">
          <tr><td style="padding:36px 36px 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#7A716A;">Clinician login</td></tr>
          <tr><td style="padding:8px 36px 0;"><h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:24px;color:#1C1C1C;margin:0;">Your clinician login is ready</h1></td></tr>
          <tr><td style="padding:16px 36px 8px;font-size:15px;line-height:1.6;color:#4A4540;">Hello ${escapeHtml(name || "there")}, Dr David Silver PhD has set up a clinician login for you, so that you can see the clients and the parts of their records you have been given access to.</td></tr>
          <tr><td style="padding:8px 36px 8px;font-size:15px;line-height:1.6;color:#4A4540;">Log in with this email address, <strong>${escapeHtml(to)}</strong>, and the password Dr David Silver PhD has given you separately. For your security, passwords are never sent in this email.</td></tr>
          <tr><td style="padding:8px 36px 16px;"><a href="${loginUrl}" style="display:inline-block;background:#1C1C1C;color:#ffffff;text-decoration:none;border-radius:10px;padding:14px 22px;font-size:15px;">Go to the login page</a></td></tr>
          <tr><td style="padding:0 36px 8px;font-size:14px;line-height:1.6;color:#4A4540;">The first time you log in on a new phone or computer, we will email you a six digit code to confirm it is you. If it has not arrived within a minute or two, please check your junk or spam folder.</td></tr>
          <tr><td style="padding:8px 36px 36px;font-size:13px;line-height:1.6;color:#7A716A;">If the button does not work, copy this address into your browser: ${loginUrl}. If you have forgotten your password, you can choose a new one from the login page.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  const { error } = await resend.emails.send({ from: fromAddress, to, subject: "Your clinician login is ready", html });
  if (error) return { sent: false, reason: error.message };
  return { sent: true };
}

// A clinician who has forgotten their password asked for a new one from the
// login page. The link is Supabase's own one time recovery token, so no
// password is ever created or seen here.
export async function sendClinicianPasswordResetEmail(to: string, name: string, url: string): Promise<void> {
  if (!resend) throw new Error("RESEND_API_KEY is not configured.");
  const fromAddress = process.env.RESEND_FROM_ADDRESS;
  if (!fromAddress) throw new Error("RESEND_FROM_ADDRESS is not configured.");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F2EDE4;font-family:-apple-system,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2EDE4;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;max-width:480px;">
          <tr><td style="padding:36px 36px 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#7A716A;">Athena Physio clinician login</td></tr>
          <tr><td style="padding:8px 36px 0;"><h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:24px;color:#1C1C1C;margin:0;">Choose a new password</h1></td></tr>
          <tr><td style="padding:16px 36px 8px;font-size:15px;line-height:1.6;color:#4A4540;">Hello ${escapeHtml(name || "there")}, use the button below to choose a new password for your clinician login. The link works once and only for a short time, so if it has expired you can ask for another from the login page.</td></tr>
          <tr><td style="padding:8px 36px 16px;"><a href="${url}" style="display:inline-block;background:#1C1C1C;color:#ffffff;text-decoration:none;border-radius:10px;padding:14px 22px;font-size:15px;">Choose a new password</a></td></tr>
          <tr><td style="padding:0 36px 36px;font-size:13px;line-height:1.6;color:#7A716A;">If you did not ask for this, you can ignore this email and your password stays as it is.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  const { error } = await resend.emails.send({ from: fromAddress, to, subject: "Choose a new password for your Athena clinician login", html });
  if (error) throw new Error(error.message);
}

// A client who has forgotten their password asked for a new one from the
// login page. Named for the app they use (ROAM for a Regenerate client).
export async function sendClientPasswordResetEmail(patientId: string, to: string, firstName: string, url: string): Promise<void> {
  if (!resend) throw new Error("RESEND_API_KEY is not configured.");
  const fromAddress = process.env.RESEND_FROM_ADDRESS;
  if (!fromAddress) throw new Error("RESEND_FROM_ADDRESS is not configured.");
  const brand = await resolveBrandPack({ patientId }).catch(() => null);
  const appName = brand?.app_layout.app_name?.trim() || "Athena";

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F2EDE4;font-family:-apple-system,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2EDE4;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;max-width:480px;">
          <tr><td style="padding:36px 36px 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#7A716A;">${escapeHtml(appName)}</td></tr>
          <tr><td style="padding:8px 36px 0;"><h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:24px;color:#1C1C1C;margin:0;">Choose a new password</h1></td></tr>
          <tr><td style="padding:16px 36px 8px;font-size:15px;line-height:1.6;color:#4A4540;">Hello ${escapeHtml(firstName || "there")}, use the button below to choose a new password for ${escapeHtml(appName)}. The link works once and only for a short time, so if it has expired you can ask for another from the login page.</td></tr>
          <tr><td style="padding:8px 36px 16px;"><a href="${url}" style="display:inline-block;background:#1C1C1C;color:#ffffff;text-decoration:none;border-radius:10px;padding:14px 22px;font-size:15px;">Choose a new password</a></td></tr>
          <tr><td style="padding:0 36px 36px;font-size:13px;line-height:1.6;color:#7A716A;">If you did not ask for this, you can ignore this email and your password stays as it is.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  const { error } = await resend.emails.send({ from: fromAddress, to, subject: `Choose a new password for ${appName}`, html });
  if (error) throw new Error(error.message);
  await logCommunication({ patientId, channel: "email", type: "password_reset", title: "Password reset link" }).catch(() => undefined);
}

// An alert to David that someone has created their own account and is
// waiting for him to approve it on the Clients list. Internal, so it keeps
// the fixed Athena look and needs no editable template.
export async function sendSignupAwaitingApprovalEmail(clientName: string, clientEmail: string): Promise<void> {
  if (!resend) throw new Error("RESEND_API_KEY is not configured.");
  const fromAddress = process.env.RESEND_FROM_ADDRESS;
  if (!fromAddress) throw new Error("RESEND_FROM_ADDRESS is not configured.");
  const name = clientName.trim() || clientEmail;
  const subject = `${name} has created an account and is waiting for you`;
  const body = `${name} (${clientEmail}) has just created an account in Athena Online.\n\nTheir app stays closed until you approve them. Open your Clients list and press Approve beside their name.`;
  const { error } = await resend.emails.send({
    from: fromAddress,
    to: OWNER_EMAIL,
    subject,
    html: buildTemplatedEmailHtml(subject, body, "Open Clients", `${APP_URL}/clinic`),
  });
  if (error) throw new Error(error.message);
}

// Who is alerted when a client answers the PHQ-9 self harm item above zero
// in the Wellbeing survey, for same day clinical review. Professor Syed Haq
// (Regenerate Chief Medical Officer) is to be added once his address is
// confirmed.
// The clinic owner always receives the alert, plus any addresses added on
// the Feature settings page (for example the supervising physician).
async function safeguardingRecipients(): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("clinic_settings")
    .select("safeguarding_alert_emails")
    .eq("id", true)
    .maybeSingle<{ safeguarding_alert_emails: string[] | null }>();
  return Array.from(new Set([OWNER_EMAIL, ...(data?.safeguarding_alert_emails ?? [])]));
}

// The safeguarding alert itself. It names the client and links to their
// forms, and deliberately does not repeat their answers in the email.
export async function sendSafeguardingAlertEmail(patientId: string): Promise<void> {
  if (!resend) throw new Error("RESEND_API_KEY is not configured.");
  const fromAddress = process.env.RESEND_FROM_ADDRESS;
  if (!fromAddress) throw new Error("RESEND_FROM_ADDRESS is not configured.");
  const { data: p } = await supabaseAdmin
    .from("patients")
    .select("first_name, last_name, mobile_phone")
    .eq("id", patientId)
    .maybeSingle<{ first_name: string; last_name: string | null; mobile_phone: string | null }>();
  const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ") || "A client";
  const subject = `Safeguarding: same day review needed for ${name}`;
  const body = `${name} has just completed the Wellbeing survey and answered above zero to the PHQ-9 item about thoughts of being better off dead or of hurting themselves.\n\nThe survey protocol asks for a same day clinical review.${
    p?.mobile_phone ? ` Their mobile number on file is ${p.mobile_phone}.` : ""
  }\n\nThe client has been shown details of where to get urgent support.`;
  const { error } = await resend.emails.send({
    from: fromAddress,
    to: await safeguardingRecipients(),
    subject,
    html: buildTemplatedEmailHtml(subject, body, "Open their forms", `${APP_URL}/clinic/patients/${patientId}/forms`),
  });
  if (error) throw new Error(error.message);
}

// An alert to David that a client has filled in the Programme intake form
// from a link. Internal, so it keeps the fixed Athena look and needs no
// editable template.
export async function sendLinkIntakeAlertEmail(clientName: string, clientEmail: string, patientId: string | null): Promise<void> {
  if (!resend) throw new Error("RESEND_API_KEY is not configured.");
  const fromAddress = process.env.RESEND_FROM_ADDRESS;
  if (!fromAddress) throw new Error("RESEND_FROM_ADDRESS is not configured.");
  const name = clientName.trim() || clientEmail;
  const subject = `${name} has filled in the Programme intake form`;
  const body = patientId
    ? `${name} (${clientEmail}) has filled in the Programme intake form from your link.\n\nTheir answers are already in their Client profile, ready for the Programme Builder.`
    : `${name} (${clientEmail}) has filled in the Programme intake form from your link.\n\nThey are not in the app yet, so their answers are waiting on the Registrations page and will be filed into their record automatically when you confirm their registration or add them as a client.`;
  const url = patientId ? `${APP_URL}/clinic/patients/${patientId}/dashboard` : `${APP_URL}/clinic/registrations`;
  const { error } = await resend.emails.send({
    from: fromAddress,
    to: OWNER_EMAIL,
    subject,
    html: buildTemplatedEmailHtml(subject, body, patientId ? "Open their record" : "Open Registrations", url),
  });
  if (error) throw new Error(error.message);
}

// The Monday digest to David: only the clients who need him, grouped by
// what they need. The body is already plain text, one section per blank
// line.
export async function sendWeeklyDigestEmail(subject: string, body: string): Promise<void> {
  if (!resend) throw new Error("RESEND_API_KEY is not configured.");
  const fromAddress = process.env.RESEND_FROM_ADDRESS;
  if (!fromAddress) throw new Error("RESEND_FROM_ADDRESS is not configured.");
  const { error } = await resend.emails.send({
    from: fromAddress,
    to: OWNER_EMAIL,
    subject,
    html: buildTemplatedEmailHtml(subject, body, "Open Clients", `${APP_URL}/clinic`),
  });
  if (error) throw new Error(error.message);
}
