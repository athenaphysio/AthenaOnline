import { NextRequest, NextResponse } from "next/server";
import { requestClientPasswordReset } from "@/lib/clientPasswordReset";

// Always answers the same way, whether or not the email is a client's.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email : "";
  await requestClientPasswordReset(email);
  return NextResponse.json({ ok: true });
}
