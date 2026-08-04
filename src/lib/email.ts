import "server-only";
import { Resend } from "resend";
import { logCommunication } from "./communications";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Every email function in this file should log itself via logCommunication
// right after Resend confirms the send -- that's what makes it show up on
// the patient's own Communications tab. Follow this same shape for any
// future email (upsell, renewal): send, then log, inside one function that
// the rest of the app just calls.
export async function sendProgrammeReadyEmail(patientId: string, to: string, firstName: string): Promise<void> {
  if (!resend) {
    throw new Error("RESEND_API_KEY is not configured.");
  }
  const fromAddress = process.env.RESEND_FROM_ADDRESS;
  if (!fromAddress) {
    throw new Error("RESEND_FROM_ADDRESS is not configured.");
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://athena-online-kappa.vercel.app";
  // They already have an account -- the clinic had to find them to attach
  // the programme -- so this must open the sign-in tab, never sign-up,
  // with their email pre-filled.
  const signInUrl = `${appUrl}/start?mode=login&email=${encodeURIComponent(to)}`;

  const { error } = await resend.emails.send({
    from: fromAddress,
    to,
    subject: "Your programme's ready",
    html: buildProgrammeReadyEmailHtml(firstName, signInUrl),
  });

  if (error) {
    throw new Error(error.message);
  }

  await logCommunication({
    patientId,
    channel: "email",
    type: "programme_ready",
    title: "Your programme's ready",
  });
}

// Same shape as sendProgrammeReadyEmail above, for a membership signup
// (subscription or upfront) instead of a programme.
export async function sendMembershipReadyEmail(
  patientId: string,
  to: string,
  firstName: string,
  tierName: string
): Promise<void> {
  if (!resend) {
    throw new Error("RESEND_API_KEY is not configured.");
  }
  const fromAddress = process.env.RESEND_FROM_ADDRESS;
  if (!fromAddress) {
    throw new Error("RESEND_FROM_ADDRESS is not configured.");
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://athena-online-kappa.vercel.app";
  const signInUrl = `${appUrl}/start?mode=login&email=${encodeURIComponent(to)}`;

  const { error } = await resend.emails.send({
    from: fromAddress,
    to,
    subject: "You're set up",
    html: buildMembershipReadyEmailHtml(firstName, tierName, signInUrl),
  });

  if (error) {
    throw new Error(error.message);
  }

  await logCommunication({
    patientId,
    channel: "email",
    type: "membership_ready",
    title: "You're set up",
  });
}

// Same shape as sendProgrammeReadyEmail above, for buying an existing
// programme outright instead of receiving a new one.
export async function sendProgrammeOwnedEmail(
  patientId: string,
  to: string,
  firstName: string,
  programmeTitle: string
): Promise<void> {
  if (!resend) {
    throw new Error("RESEND_API_KEY is not configured.");
  }
  const fromAddress = process.env.RESEND_FROM_ADDRESS;
  if (!fromAddress) {
    throw new Error("RESEND_FROM_ADDRESS is not configured.");
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://athena-online-kappa.vercel.app";
  const signInUrl = `${appUrl}/start?mode=login&email=${encodeURIComponent(to)}`;

  const { error } = await resend.emails.send({
    from: fromAddress,
    to,
    subject: "Yours to keep",
    html: buildProgrammeOwnedEmailHtml(firstName, programmeTitle, signInUrl),
  });

  if (error) {
    throw new Error(error.message);
  }

  await logCommunication({
    patientId,
    channel: "email",
    type: "programme_owned",
    title: "Yours to keep",
  });
}

function buildProgrammeReadyEmailHtml(firstName: string, appUrl: string): string {
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
                <h1 style="font-family: Georgia, 'Times New Roman', serif; font-weight:400; font-size:26px; color:#1C1C1C; margin:0;">You're all set, ${escapeHtml(firstName)}.</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 36px 28px;">
                <p style="font-size:15px;line-height:1.6;color:#4A4540;margin:0;">David's built your programme, it's live now. Open the app to get started.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 36px 36px;">
                <a href="${appUrl}" style="display:inline-block;background:#9B1C1C;color:#ffffff;font-size:15px;font-weight:500;text-decoration:none;padding:13px 26px;border-radius:9px;">Open my programme</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildMembershipReadyEmailHtml(firstName: string, tierName: string, appUrl: string): string {
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
                <h1 style="font-family: Georgia, 'Times New Roman', serif; font-weight:400; font-size:26px; color:#1C1C1C; margin:0;">You're set up, ${escapeHtml(firstName)}.</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 36px 28px;">
                <p style="font-size:15px;line-height:1.6;color:#4A4540;margin:0;">Your ${escapeHtml(tierName)} membership is active. Open the app to see what's included.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 36px 36px;">
                <a href="${appUrl}" style="display:inline-block;background:#9B1C1C;color:#ffffff;font-size:15px;font-weight:500;text-decoration:none;padding:13px 26px;border-radius:9px;">Open the app</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildProgrammeOwnedEmailHtml(firstName: string, programmeTitle: string, appUrl: string): string {
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
                <h1 style="font-family: Georgia, 'Times New Roman', serif; font-weight:400; font-size:26px; color:#1C1C1C; margin:0;">Yours to keep, ${escapeHtml(firstName)}.</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 36px 28px;">
                <p style="font-size:15px;line-height:1.6;color:#4A4540;margin:0;">${escapeHtml(programmeTitle)} is yours now, for good. No expiry, no subscription attached to it. Open the app whenever you want it.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 36px 36px;">
                <a href="${appUrl}" style="display:inline-block;background:#9B1C1C;color:#ffffff;font-size:15px;font-weight:500;text-decoration:none;padding:13px 26px;border-radius:9px;">Open the app</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
