import { NextRequest, NextResponse } from "next/server";
import { requestCoachPasswordReset } from "@/lib/coachPasswordReset";

// Always answers the same way, whether or not the email is a clinician's.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email : "";
  await requestCoachPasswordReset(email);
  return NextResponse.json({ ok: true });
}
