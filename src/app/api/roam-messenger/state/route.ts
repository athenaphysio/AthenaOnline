import { NextResponse } from "next/server";
import { getMessengerLogin, hasPasskey, isUnlocked } from "@/lib/roamMessenger/identity";

// Where the messenger should start: sign in, a device code, turn on Face
// ID, unlock, or straight into the inbox. Says nothing about any client.
export async function GET() {
  const login = await getMessengerLogin();
  if (login.state !== "signed_in") return NextResponse.json({ state: login.state });
  const { user } = login;
  if (!(await hasPasskey(user))) return NextResponse.json({ state: "needs_face_id", name: user.name });
  if (!(await isUnlocked(user))) return NextResponse.json({ state: "locked", name: user.name });
  return NextResponse.json({ state: "ready", name: user.name, kind: user.kind });
}
