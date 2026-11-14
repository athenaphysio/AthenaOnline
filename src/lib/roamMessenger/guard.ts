import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getMessengerLogin, isUnlocked, setUnlocked, type MessengerUser } from "@/lib/roamMessenger/identity";

// Every Roam Messenger API route starts here. A route that reads or sends
// messages needs the user signed in AND unlocked with Face ID; each such
// request also keeps the lock open for a few more minutes.

export type Guarded = { user: MessengerUser } | { response: NextResponse };

export async function requireSignedIn(): Promise<Guarded> {
  const login = await getMessengerLogin();
  if (login.state !== "signed_in") {
    return { response: NextResponse.json({ error: "Please sign in.", state: login.state }, { status: 401 }) };
  }
  return { user: login.user };
}

export async function requireUnlocked(): Promise<Guarded> {
  const signed = await requireSignedIn();
  if ("response" in signed) return signed;
  if (!(await isUnlocked(signed.user))) {
    return { response: NextResponse.json({ error: "Locked.", state: "locked" }, { status: 423 }) };
  }
  await setUnlocked(signed.user);
  return signed;
}

// Face ID passkeys belong to one web address. The app answers on more than
// one, so the address is taken from the request itself.
export function relyingParty(request: NextRequest): { rpID: string; origin: string } {
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost").split(",")[0].trim();
  const rpID = host.replace(/:\d+$/, "");
  const proto = rpID === "localhost" ? "http" : "https";
  return { rpID, origin: `${proto}://${host}` };
}
