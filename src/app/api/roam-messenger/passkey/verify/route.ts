import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSignedIn, relyingParty } from "@/lib/roamMessenger/guard";
import { CHALLENGE_COOKIE, readSigned, setUnlocked } from "@/lib/roamMessenger/identity";

// The second half: the phone has checked Face ID and signed the challenge.
// Turning Face ID on also unlocks straight away.
export async function POST(request: NextRequest) {
  const guard = await requireSignedIn();
  if ("response" in guard) return guard.response;
  const { user } = guard;

  const jar = await cookies();
  const parts = readSigned(jar.get(CHALLENGE_COOKIE)?.value, 4);
  jar.delete({ name: CHALLENGE_COOKIE, path: "/api/roam-messenger/passkey" });
  if (!parts) return NextResponse.json({ error: "That took too long. Please try again." }, { status: 400 });
  const [challenge, mode, key, exp] = parts;
  if (key !== user.key || Number(exp) < Date.now()) {
    return NextResponse.json({ error: "That took too long. Please try again." }, { status: 400 });
  }

  const { rpID, origin } = relyingParty(request);
  const { response, deviceLabel } = (await request.json()) as { response: unknown; deviceLabel?: string };

  try {
    if (mode === "register") {
      const result = await verifyRegistrationResponse({
        response: response as RegistrationResponseJSON,
        expectedChallenge: challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
      });
      if (!result.verified) return NextResponse.json({ error: "Face ID could not be set up." }, { status: 400 });
      const cred = result.registrationInfo.credential;
      const { error } = await supabaseAdmin.from("roam_messenger_passkeys").insert({
        user_key: user.key,
        credential_id: cred.id,
        public_key: Buffer.from(cred.publicKey).toString("base64url"),
        counter: cred.counter,
        transports: cred.transports ?? [],
        device_label: deviceLabel?.slice(0, 120) ?? null,
        last_used_at: new Date().toISOString(),
      });
      if (error) return NextResponse.json({ error: "Face ID could not be saved. Please try again." }, { status: 500 });
    } else {
      const auth = response as AuthenticationResponseJSON;
      const { data: row } = await supabaseAdmin
        .from("roam_messenger_passkeys")
        .select("id, credential_id, public_key, counter, transports")
        .eq("user_key", user.key)
        .eq("credential_id", auth.id)
        .maybeSingle<{ id: string; credential_id: string; public_key: string; counter: number; transports: string[] }>();
      if (!row) return NextResponse.json({ error: "This phone's Face ID is not set up for Roam Messenger." }, { status: 400 });
      const result = await verifyAuthenticationResponse({
        response: auth,
        expectedChallenge: challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
        credential: {
          id: row.credential_id,
          publicKey: new Uint8Array(Buffer.from(row.public_key, "base64url")),
          counter: Number(row.counter),
          transports: row.transports as AuthenticatorTransportFuture[],
        },
      });
      if (!result.verified) return NextResponse.json({ error: "Face ID did not match." }, { status: 400 });
      await supabaseAdmin
        .from("roam_messenger_passkeys")
        .update({ counter: result.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
        .eq("id", row.id);
    }
  } catch (err) {
    console.error("roam passkey verify failed", err);
    return NextResponse.json({ error: "Face ID could not be checked. Please try again." }, { status: 400 });
  }

  await setUnlocked(user);
  return NextResponse.json({ ok: true });
}
