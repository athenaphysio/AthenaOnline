import "server-only";
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type CoachIdentity = { id: string; name: string; email: string };

// A clinician (staff role "coach") logs in with email and password, and on
// a device they have not used before also enters a six digit code emailed
// to them. A confirmed device is remembered for 30 days by a cookie whose
// token is stored only as a hash.
export const DEVICE_COOKIE = "coach_device";
const DEVICE_DAYS = 30;
const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function secret(): string {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  return s;
}

function hash(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

// Logged in with a password, whether or not this device is confirmed yet.
// Only the code screen itself should use this directly.
export async function getCoachLogin(): Promise<CoachIdentity | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: staff } = await supabase
    .from("staff")
    .select("id, name, email, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!staff || staff.role !== "coach") return null;

  return { id: staff.id, name: staff.name, email: staff.email };
}

async function deviceConfirmed(staffId: string): Promise<boolean> {
  const token = (await cookies()).get(DEVICE_COOKIE)?.value;
  if (!token) return false;
  const { data } = await supabaseAdmin
    .from("staff_trusted_devices")
    .select("id")
    .eq("staff_id", staffId)
    .eq("token_hash", hash(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle<{ id: string }>();
  if (!data) return false;
  await supabaseAdmin.from("staff_trusted_devices").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return true;
}

// Returns the logged-in clinician only when this device is confirmed too.
// Use in API routes, where you return a 401 yourself.
export async function getCoach(): Promise<CoachIdentity | null> {
  const coach = await getCoachLogin();
  if (!coach) return null;
  return (await deviceConfirmed(coach.id)) ? coach : null;
}

// For pages: sends anyone not fully logged in to the right screen.
export async function requireCoach(): Promise<CoachIdentity> {
  const coach = await getCoachLogin();
  if (!coach) redirect("/coach/login");
  if (!(await deviceConfirmed(coach.id))) redirect("/coach/verify");
  return coach;
}

// ---------------------------------------------------------------------------
// Codes
// ---------------------------------------------------------------------------

// Creates a new code, replacing any earlier unused one. Limited to one a
// minute and five an hour, so the email cannot be used to flood an inbox.
export async function issueLoginCode(staffId: string): Promise<{ code: string } | { error: string }> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabaseAdmin
    .from("staff_login_codes")
    .select("created_at")
    .eq("staff_id", staffId)
    .gt("created_at", since)
    .order("created_at", { ascending: false })
    .returns<{ created_at: string }[]>();
  if ((recent ?? []).length >= 5) return { error: "Too many codes requested. Please wait an hour and try again." };
  if (recent?.[0] && Date.now() - Date.parse(recent[0].created_at) < 60 * 1000) {
    return { error: "A code was sent less than a minute ago. Please check your inbox, or wait a moment." };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await supabaseAdmin.from("staff_login_codes").update({ used_at: new Date().toISOString() }).eq("staff_id", staffId).is("used_at", null);
  const { error } = await supabaseAdmin.from("staff_login_codes").insert({
    staff_id: staffId,
    code_hash: hash(`${staffId}:${code}`),
    expires_at: new Date(Date.now() + CODE_MINUTES * 60 * 1000).toISOString(),
  });
  if (error) return { error: "The code could not be created. Please try again." };
  return { code };
}

// Checks a code and, when right, confirms this device for 30 days.
export async function checkLoginCode(staffId: string, code: string, userAgent: string | null): Promise<{ ok: true } | { error: string }> {
  const { data: row } = await supabaseAdmin
    .from("staff_login_codes")
    .select("id, code_hash, attempts, expires_at")
    .eq("staff_id", staffId)
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; code_hash: string; attempts: number; expires_at: string }>();

  if (!row || Date.parse(row.expires_at) < Date.now()) return { error: "That code has expired. Please send a new one." };
  if (row.attempts >= MAX_ATTEMPTS) return { error: "Too many attempts. Please send a new code." };

  await supabaseAdmin.from("staff_login_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);

  const expected = Buffer.from(row.code_hash, "hex");
  const given = Buffer.from(hash(`${staffId}:${code.replace(/\D/g, "")}`), "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    const left = MAX_ATTEMPTS - row.attempts - 1;
    return { error: left > 0 ? `That code is not right. ${left} attempt${left === 1 ? "" : "s"} left.` : "Too many attempts. Please send a new code." };
  }

  await supabaseAdmin.from("staff_login_codes").update({ used_at: new Date().toISOString() }).eq("id", row.id);

  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + DEVICE_DAYS * 24 * 60 * 60 * 1000);
  const { error } = await supabaseAdmin.from("staff_trusted_devices").insert({
    staff_id: staffId,
    token_hash: hash(token),
    user_agent: userAgent?.slice(0, 300) ?? null,
    expires_at: expires.toISOString(),
  });
  if (error) return { error: "This device could not be confirmed. Please try again." };

  (await cookies()).set(DEVICE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
  return { ok: true };
}

// Logging out also forgets this device, so the next login on it asks for a
// code again. Useful on a shared computer.
export async function forgetThisDevice(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(DEVICE_COOKIE)?.value;
  if (token) await supabaseAdmin.from("staff_trusted_devices").delete().eq("token_hash", hash(token));
  jar.delete(DEVICE_COOKIE);
}
