import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";

// Marks a safeguarding alert as reviewed, recording who did it, which takes
// it off the clinic home page.
export async function PATCH(request: NextRequest) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, reviewedBy } = (await request.json()) as { id?: unknown; reviewedBy?: unknown };
  if (typeof id !== "string") return NextResponse.json({ error: "Which alert?" }, { status: 400 });
  const by = typeof reviewedBy === "string" ? reviewedBy.trim().slice(0, 120) : "";
  if (!by) return NextResponse.json({ error: "Add who reviewed it." }, { status: 400 });
  const { error } = await supabaseAdmin
    .from("safeguarding_alerts")
    .update({ reviewed_at: new Date().toISOString(), reviewed_by: by })
    .eq("id", id)
    .is("reviewed_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
