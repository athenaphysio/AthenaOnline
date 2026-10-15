import { NextResponse } from "next/server";
import { resendInvite } from "@/lib/clientInvite";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const result = await resendInvite(id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, email_sent: result.emailSent, email_error: result.emailError ?? null });
}
