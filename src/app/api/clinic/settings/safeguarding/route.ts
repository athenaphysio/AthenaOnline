import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";

// Extra addresses for the safeguarding alert, alongside the clinic owner.
export async function PATCH(request: NextRequest) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { emails } = (await request.json()) as { emails?: unknown };
  if (!Array.isArray(emails)) return NextResponse.json({ error: "A list of email addresses is needed." }, { status: 400 });
  const clean = Array.from(new Set(emails.filter((e): e is string => typeof e === "string").map((e) => e.trim().toLowerCase()).filter(Boolean)));
  const bad = clean.find((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  if (bad) return NextResponse.json({ error: `"${bad}" doesn't look like an email address.` }, { status: 400 });
  const { error } = await supabaseAdmin.from("clinic_settings").update({ safeguarding_alert_emails: clean.slice(0, 10) }).eq("id", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ emails: clean.slice(0, 10) });
}
