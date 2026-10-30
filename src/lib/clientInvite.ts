import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendClientInviteEmail } from "@/lib/email";
import { resolveBrandPack } from "@/lib/brandPackResolve";

export type InviteResult =
  | { ok: true; patientId: string; emailSent: boolean; emailError?: string }
  | { ok: false; status: number; error: string };

const ALREADY_ON_APP = "This client is already on the app.";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://athena-online-kappa.vercel.app";
}

const INVITE_DAYS = 7;

function hashToken(token: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  return createHmac("sha256", secret).update(`invite:${token}`).digest("hex");
}

// The link in the welcome email: the app's own, valid for seven days. It
// never contains a login token itself; one is made fresh when it is opened
// (see redeemInviteLink), so the login system's one hour limit no longer
// matters.
async function createInviteLink(patientId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const { error } = await supabaseAdmin.from("client_invite_links").insert({
    patient_id: patientId,
    token_hash: hashToken(token),
    expires_at: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (error) throw new Error(error.message);
  // A client on a brand pack lands on a page in their own brand.
  const brand = await resolveBrandPack({ patientId }).catch(() => null);
  const brandParam = brand && !brand.isAllDefault ? `&brand=${encodeURIComponent(brand.id)}` : "";
  return `${appUrl()}/start/set-password?invite=${encodeURIComponent(token)}${brandParam}`;
}

export type RedeemResult =
  | { ok: true; tokenHash: string; type: "invite" | "magiclink" }
  | { ok: false; reason: "expired" | "already_set_up" | "unknown" };

// Opening the welcome link: checks it is one of ours, in date, and that the
// client has not already chosen a password, then makes a fresh one time
// login token for the page to sign them in with straight away.
export async function redeemInviteLink(token: string): Promise<RedeemResult> {
  if (!token || token.length > 200) return { ok: false, reason: "unknown" };
  const { data: link } = await supabaseAdmin
    .from("client_invite_links")
    .select("id, patient_id, expires_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle<{ id: string; patient_id: string; expires_at: string }>();
  if (!link) return { ok: false, reason: "unknown" };
  if (Date.parse(link.expires_at) < Date.now()) return { ok: false, reason: "expired" };

  const { data: patient } = await supabaseAdmin
    .from("patients")
    .select("email, password_set_at")
    .eq("id", link.patient_id)
    .maybeSingle<{ email: string; password_set_at: string | null }>();
  if (!patient) return { ok: false, reason: "unknown" };
  if (patient.password_set_at) return { ok: false, reason: "already_set_up" };

  // An account that has never been confirmed takes an invite token; one
  // that has (for example after an earlier link was opened) takes a
  // sign in token.
  for (const type of ["invite", "magiclink"] as const) {
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type, email: patient.email });
    const hashed = data?.properties?.hashed_token;
    if (!error && hashed) {
      return { ok: true, tokenHash: hashed, type: (data.properties.verification_type as "invite" | "magiclink") ?? type };
    }
  }
  return { ok: false, reason: "unknown" };
}

// Once a password is chosen, every joining link for that client stops working.
export async function retireInviteLinks(patientId: string): Promise<void> {
  await supabaseAdmin
    .from("client_invite_links")
    .update({ used_at: new Date().toISOString() })
    .eq("patient_id", patientId)
    .is("used_at", null);
  await supabaseAdmin.from("client_invite_links").update({ expires_at: new Date().toISOString() }).eq("patient_id", patientId);
}

// "Email me a new link" from the expired page. Sends only when the email
// belongs to a client who was invited and has not set a password, and not
// more than once every ten minutes. Says nothing either way, so the page
// cannot be used to find out who is a client.
export async function requestNewInvite(email: string): Promise<void> {
  const clean = email.trim().toLowerCase();
  if (!looksLikeEmail(clean)) return;
  const { data: patient } = await supabaseAdmin
    .from("patients")
    .select("id, invited_at, password_set_at")
    .ilike("email", clean)
    .maybeSingle<{ id: string; invited_at: string | null; password_set_at: string | null }>();
  if (!patient || !patient.invited_at || patient.password_set_at) return;
  const { data: recent } = await supabaseAdmin
    .from("client_invite_links")
    .select("created_at")
    .eq("patient_id", patient.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ created_at: string }>();
  if (recent && Date.now() - Date.parse(recent.created_at) < 10 * 60 * 1000) return;
  await resendInvite(patient.id);
}

export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// One-time link the client uses to choose their own password. Built from
// Supabase's own invite token, so no password is ever created or seen here.
// The link opens /start/set-password, which signs them in with the token.
async function buildSetupLink(
  email: string,
  metadata: Record<string, string>
): Promise<{ url: string; userId: string } | { error: string; alreadyExists: boolean }> {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { data: metadata },
  });
  if (error || !data?.properties?.hashed_token) {
    const message = error?.message ?? "Couldn't create the invitation.";
    return { error: message, alreadyExists: /already|registered|exists/i.test(message) };
  }
  const type = data.properties.verification_type ?? "invite";
  const url = `${appUrl()}/start/set-password?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=${encodeURIComponent(type)}`;
  return { url, userId: data.user.id };
}

export async function inviteClient(input: {
  firstName: string;
  lastName: string;
  email: string;
  notes: string;
}): Promise<InviteResult> {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const email = input.email.trim().toLowerCase();
  const notes = input.notes.trim();

  if (!firstName || !lastName) return { ok: false, status: 400, error: "Please enter a first name and a last name." };
  if (!looksLikeEmail(email)) return { ok: false, status: 400, error: "Please enter a valid email address." };

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("patients")
    .select("id")
    .ilike("email", email)
    .limit(1);
  if (lookupError) return { ok: false, status: 500, error: lookupError.message };
  if (existing && existing.length > 0) return { ok: false, status: 409, error: ALREADY_ON_APP };

  const link = await buildSetupLink(email, { first_name: firstName, last_name: lastName, role: "patient" });
  if ("error" in link) {
    if (link.alreadyExists) return { ok: false, status: 409, error: ALREADY_ON_APP };
    return { ok: false, status: 500, error: link.error };
  }

  // The database creates the client row the moment the login account is
  // made; this adds the rest of what David typed and marks them invited.
  const { error: updateError } = await supabaseAdmin
    .from("patients")
    .update({
      first_name: firstName,
      last_name: lastName,
      clinic_notes: notes || null,
      invited_at: new Date().toISOString(),
      // Invited by David, so already approved.
      awaiting_approval: false,
    })
    .eq("id", link.userId);
  if (updateError) return { ok: false, status: 500, error: updateError.message };

  let lastingUrl: string;
  try {
    lastingUrl = await createInviteLink(link.userId);
  } catch (err) {
    return { ok: false, status: 500, error: err instanceof Error ? err.message : "Couldn't create the joining link." };
  }
  return sendAndReport(link.userId, email, firstName, lastingUrl);
}

async function sendAndReport(patientId: string, email: string, firstName: string, url: string): Promise<InviteResult> {
  try {
    const sent = await sendClientInviteEmail(patientId, email, firstName, url);
    if (!sent.sent) return { ok: true, patientId, emailSent: false, emailError: sent.reason };
    return { ok: true, patientId, emailSent: true };
  } catch (err) {
    return { ok: true, patientId, emailSent: false, emailError: err instanceof Error ? err.message : String(err) };
  }
}

// A fresh link and a fresh email for someone who has not set a password yet.
export async function resendInvite(patientId: string): Promise<InviteResult> {
  const { data: patient } = await supabaseAdmin
    .from("patients")
    .select("id, first_name, last_name, email, invited_at, password_set_at")
    .eq("id", patientId)
    .maybeSingle<{
      id: string;
      first_name: string;
      last_name: string | null;
      email: string;
      invited_at: string | null;
      password_set_at: string | null;
    }>();
  if (!patient) return { ok: false, status: 404, error: "Client not found." };
  if (!patient.invited_at || patient.password_set_at) {
    return { ok: false, status: 409, error: "This client has already set up their account." };
  }

  let url: string;
  try {
    url = await createInviteLink(patient.id);
  } catch (err) {
    return { ok: false, status: 500, error: err instanceof Error ? err.message : "Couldn't create the joining link." };
  }
  await supabaseAdmin.from("patients").update({ invited_at: new Date().toISOString() }).eq("id", patient.id);
  return sendAndReport(patient.id, patient.email, patient.first_name, url);
}
