import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";
import { getCoach, getCoachLogin } from "@/lib/coachAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Who is using Roam Messenger. Either David, signed in with the clinic
// login, or a clinician (a staff row with role "coach") signed in with
// their own email, password and confirmed device. Both logins already
// exist in the app; the messenger adds nothing new to how people sign in,
// only a Face ID lock on top (see the lock section below).

export type MessengerUser =
  | { kind: "owner"; key: "owner"; name: string }
  | { kind: "coach"; key: `staff:${string}`; staffId: string; name: string };

export const OWNER_DISPLAY_NAME = "Dr David Silver PhD";

export type MessengerLogin =
  | { state: "signed_in"; user: MessengerUser }
  | { state: "needs_device_code" }
  | { state: "signed_out" };

export async function getMessengerLogin(): Promise<MessengerLogin> {
  if (await isClinicAdminRequest()) {
    return { state: "signed_in", user: { kind: "owner", key: "owner", name: OWNER_DISPLAY_NAME } };
  }
  const coach = await getCoach();
  if (coach) {
    return { state: "signed_in", user: { kind: "coach", key: `staff:${coach.id}`, staffId: coach.id, name: coach.name } };
  }
  if (await getCoachLogin()) return { state: "needs_device_code" };
  return { state: "signed_out" };
}

// ---------------------------------------------------------------------------
// The Face ID lock
// ---------------------------------------------------------------------------
// Signing in is remembered for 30 days on a phone, which on its own would
// leave every conversation open to anyone who picked the phone up. So the
// messenger is also locked: opening it asks for Face ID (or fingerprint),
// and it locks itself again after a few minutes without use. The unlock is
// a short-lived signed cookie, refreshed on every request while in use.

export const UNLOCK_COOKIE = "roam_unlock";
/** Holds the one-off Face ID challenge between its two steps. */
export const CHALLENGE_COOKIE = "roam_webauthn";
export const UNLOCK_MINUTES = 5;

function secret(): string {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  return s;
}

export function sign(value: string): string {
  return createHmac("sha256", secret()).update(`roam-messenger:${value}`).digest("base64url");
}

export function signedValue(parts: string[]): string {
  const joined = parts.join("|");
  return `${joined}|${sign(joined)}`;
}

/** Returns the parts if the signature is right, otherwise null. */
export function readSigned(raw: string | undefined, partCount: number): string[] | null {
  if (!raw) return null;
  const pieces = raw.split("|");
  if (pieces.length !== partCount + 1) return null;
  const mac = pieces.pop()!;
  const expected = Buffer.from(sign(pieces.join("|")));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return pieces;
}

export async function isUnlocked(user: MessengerUser): Promise<boolean> {
  const parts = readSigned((await cookies()).get(UNLOCK_COOKIE)?.value, 2);
  if (!parts) return false;
  const [key, exp] = parts;
  return key === user.key && Number(exp) > Date.now();
}

export async function setUnlocked(user: MessengerUser): Promise<void> {
  const exp = Date.now() + UNLOCK_MINUTES * 60 * 1000;
  (await cookies()).set(UNLOCK_COOKIE, signedValue([user.key, String(exp)]), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: UNLOCK_MINUTES * 60,
  });
}

export async function lockNow(): Promise<void> {
  (await cookies()).delete(UNLOCK_COOKIE);
}

export async function hasPasskey(user: MessengerUser): Promise<boolean> {
  const { count } = await supabaseAdmin
    .from("roam_messenger_passkeys")
    .select("id", { count: "exact", head: true })
    .eq("user_key", user.key);
  return (count ?? 0) > 0;
}
