import { NextResponse } from "next/server";
import { getCoachLogin, issueLoginCode } from "@/lib/coachAuth";
import { sendClinicianLoginCodeEmail } from "@/lib/email";

// Emails a fresh six digit code to the logged-in clinician.
export async function POST() {
  const coach = await getCoachLogin();
  if (!coach) return NextResponse.json({ error: "Please log in again." }, { status: 401 });

  const issued = await issueLoginCode(coach.id);
  if ("error" in issued) return NextResponse.json({ error: issued.error }, { status: 429 });

  try {
    await sendClinicianLoginCodeEmail(coach.email, coach.name, issued.code);
  } catch (err) {
    console.error("login code email failed", err);
    return NextResponse.json({ error: "The email could not be sent. Please try again in a moment." }, { status: 502 });
  }
  return NextResponse.json({ sentTo: maskEmail(coach.email) });
}

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  return `${user.slice(0, 2)}${"•".repeat(Math.max(1, user.length - 2))}@${domain}`;
}
