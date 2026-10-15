import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendClientInviteEmail } from "@/lib/email";

export type InviteResult =
  | { ok: true; patientId: string; emailSent: boolean; emailError?: string }
  | { ok: false; status: number; error: string };

const ALREADY_ON_APP = "This client is already on the app.";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://athena-online-kappa.vercel.app";
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
    })
    .eq("id", link.userId);
  if (updateError) return { ok: false, status: 500, error: updateError.message };

  return sendAndReport(link.userId, email, firstName, link.url);
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

  const link = await buildSetupLink(patient.email, {
    first_name: patient.first_name,
    last_name: patient.last_name ?? "",
    role: "patient",
  });
  if ("error" in link) {
    // An invite link can't be made again once Supabase has confirmed the
    // account; a sign-in style link is the right one then.
    const { data: magic, error: magicError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: patient.email,
    });
    if (magicError || !magic?.properties?.hashed_token) {
      return { ok: false, status: 500, error: link.error };
    }
    const url = `${appUrl()}/start/set-password?token_hash=${encodeURIComponent(magic.properties.hashed_token)}&type=${encodeURIComponent(
      magic.properties.verification_type ?? "magiclink"
    )}`;
    return sendAndReport(patient.id, patient.email, patient.first_name, url);
  }
  await supabaseAdmin.from("patients").update({ invited_at: new Date().toISOString() }).eq("id", patient.id);
  return sendAndReport(patient.id, patient.email, patient.first_name, link.url);
}
