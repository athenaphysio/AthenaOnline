import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";
import { sendClinicianWelcomeEmail } from "@/lib/email";

// The Resend login email button on the Staff screen: sends the clinician
// the welcome again, with the login page and their login email (never the
// password), for when the first one was missed or never went out.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { data: staff, error } = await supabaseAdmin.from("staff").select("name, email").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!staff?.email) return NextResponse.json({ error: "No clinician with an email address was found." }, { status: 404 });
  try {
    const result = await sendClinicianWelcomeEmail(staff.email, staff.name ?? "");
    if (!result.sent) return NextResponse.json({ error: `The email did not go out: ${result.reason ?? "unknown reason"}.` }, { status: 502 });
    return NextResponse.json({ ok: true, email: staff.email });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `The email did not go out: ${detail}.` }, { status: 502 });
  }
}
