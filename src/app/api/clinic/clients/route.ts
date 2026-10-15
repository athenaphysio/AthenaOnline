import { NextRequest, NextResponse } from "next/server";
import { inviteClient } from "@/lib/clientInvite";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";

// "Add client": saves the client, creates their login with a one-time setup
// link, and emails them. Admin only, checked here on the server.
export async function POST(request: NextRequest) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { first_name, last_name, email, notes } = body as {
    first_name?: string;
    last_name?: string;
    email?: string;
    notes?: string;
  };

  const result = await inviteClient({
    firstName: first_name ?? "",
    lastName: last_name ?? "",
    email: email ?? "",
    notes: notes ?? "",
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, id: result.patientId, email_sent: result.emailSent, email_error: result.emailError ?? null });
}
