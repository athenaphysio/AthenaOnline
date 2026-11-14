import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generateAuthenticationOptions, generateRegistrationOptions } from "@simplewebauthn/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSignedIn, relyingParty } from "@/lib/roamMessenger/guard";
import { CHALLENGE_COOKIE, signedValue } from "@/lib/roamMessenger/identity";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";

const CHALLENGE_SECONDS = 180;

// The first half of turning on Face ID ("register") or of unlocking with
// it ("unlock"): the phone is sent a one-off challenge to sign.
export async function POST(request: NextRequest) {
  const guard = await requireSignedIn();
  if ("response" in guard) return guard.response;
  const { user } = guard;
  const { mode } = (await request.json().catch(() => ({}))) as { mode?: string };
  if (mode !== "register" && mode !== "unlock") return NextResponse.json({ error: "Unknown mode." }, { status: 400 });

  const { rpID } = relyingParty(request);
  const { data: existing } = await supabaseAdmin
    .from("roam_messenger_passkeys")
    .select("credential_id, transports")
    .eq("user_key", user.key)
    .returns<{ credential_id: string; transports: string[] }[]>();
  const creds = (existing ?? []).map((c) => ({ id: c.credential_id, transports: c.transports as AuthenticatorTransportFuture[] }));

  let options;
  if (mode === "register") {
    options = await generateRegistrationOptions({
      rpName: "Roam Messenger",
      rpID,
      userName: user.name,
      userDisplayName: user.name,
      userID: new TextEncoder().encode(user.key),
      attestationType: "none",
      excludeCredentials: creds,
      // The phone's own Face ID or fingerprint, always checked.
      authenticatorSelection: { authenticatorAttachment: "platform", residentKey: "preferred", userVerification: "required" },
    });
  } else {
    if (creds.length === 0) return NextResponse.json({ error: "Face ID is not set up yet." }, { status: 400 });
    options = await generateAuthenticationOptions({ rpID, allowCredentials: creds, userVerification: "required" });
  }

  const exp = Date.now() + CHALLENGE_SECONDS * 1000;
  (await cookies()).set(CHALLENGE_COOKIE, signedValue([options.challenge, mode, user.key, String(exp)]), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/roam-messenger/passkey",
    maxAge: CHALLENGE_SECONDS,
  });
  return NextResponse.json({ options });
}
