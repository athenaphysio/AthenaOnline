import { NextRequest, NextResponse } from "next/server";
import { requestNewInvite } from "@/lib/clientInvite";

// "Email me a new link". Always answers the same way, whether or not a new
// link was sent, so it cannot be used to find out who is a client.
export async function POST(request: NextRequest) {
  const { email } = (await request.json().catch(() => ({}))) as { email?: string };
  try {
    await requestNewInvite(email ?? "");
  } catch (err) {
    console.error("new invite request failed", err);
  }
  return NextResponse.json({ ok: true });
}
