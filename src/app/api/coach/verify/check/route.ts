import { NextRequest, NextResponse } from "next/server";
import { checkLoginCode, getCoachLogin } from "@/lib/coachAuth";

// Checks the code and, if right, confirms this device for 30 days.
export async function POST(request: NextRequest) {
  const coach = await getCoachLogin();
  if (!coach) return NextResponse.json({ error: "Please log in again." }, { status: 401 });

  const { code } = (await request.json()) as { code?: string };
  if (!code || !/^\d{6}$/.test(code.replace(/\D/g, ""))) {
    return NextResponse.json({ error: "Please enter the six digit code from the email." }, { status: 400 });
  }

  const result = await checkLoginCode(coach.id, code, request.headers.get("user-agent"));
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
