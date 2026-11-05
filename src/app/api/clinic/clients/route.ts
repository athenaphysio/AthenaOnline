import { NextRequest, NextResponse } from "next/server";
import { inviteClient } from "@/lib/clientInvite";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { applyRegistration, findOpenRegistration } from "@/lib/registrations";
import { findBuilderForm, sendFormToPatients } from "@/lib/sendForm";

// "Add client": saves the client, creates their login with a one-time setup
// link, and emails them. Admin only, checked here on the server.
export async function POST(request: NextRequest) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { first_name, last_name, email, notes, send_intake } = body as {
    first_name?: string;
    last_name?: string;
    email?: string;
    notes?: string;
    send_intake?: boolean;
  };

  const result = await inviteClient({
    firstName: first_name ?? "",
    lastName: last_name ?? "",
    email: email ?? "",
    notes: notes ?? "",
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  // The same follow-on work Approve does, so every client arrives the same
  // way: their sign-up form copied across if they filled one in, and the
  // Programme intake form sent for a remote client. Best-effort; the client
  // is already added and invited either way.
  try {
    const registration = email ? await findOpenRegistration(email) : null;
    if (registration) {
      const { data: patient } = await supabaseAdmin
        .from("patients")
        .select("id, photo_path")
        .eq("id", result.patientId)
        .maybeSingle<{ id: string; photo_path: string | null }>();
      if (patient) await applyRegistration(registration, patient);
    }
    if (send_intake) {
      const form = await findBuilderForm("intake");
      if (form) await sendFormToPatients(form.id, form.title, [result.patientId]);
    }
  } catch (err) {
    console.error("add client follow-on failed", err);
  }

  return NextResponse.json({ ok: true, id: result.patientId, email_sent: result.emailSent, email_error: result.emailError ?? null });
}
