import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Records that one client's results from one test date were reviewed and
// signed off at a multidisciplinary meeting. Only then can they be released.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await request.json()) as { taken_on?: unknown; meeting_on?: unknown; clinicians?: unknown; note?: unknown };
  const clinicians = typeof body.clinicians === "string" ? body.clinicians.trim() : "";
  if (typeof body.taken_on !== "string" || !DATE.test(body.taken_on)) return NextResponse.json({ error: "Choose the test date." }, { status: 400 });
  if (typeof body.meeting_on !== "string" || !DATE.test(body.meeting_on)) return NextResponse.json({ error: "Add the date of the meeting." }, { status: 400 });
  if (!clinicians) return NextResponse.json({ error: "Name the clinicians who signed the results off." }, { status: 400 });
  const { error } = await supabaseAdmin.from("passport_signoffs").upsert(
    {
      patient_id: id,
      taken_on: body.taken_on,
      meeting_on: body.meeting_on,
      clinicians: clinicians.slice(0, 500),
      note: typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 2000) : null,
    },
    { onConflict: "patient_id,taken_on" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Withdrawing a sign-off puts every released result from that date back to
// draft, so the client never sees results that are no longer signed off.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { taken_on } = (await request.json()) as { taken_on?: unknown };
  if (typeof taken_on !== "string" || !DATE.test(taken_on)) return NextResponse.json({ error: "Choose the test date." }, { status: 400 });
  const back = await supabaseAdmin
    .from("passport_results")
    .update({ status: "draft", released_at: null, updated_at: new Date().toISOString() })
    .eq("patient_id", id)
    .eq("taken_on", taken_on);
  if (back.error) return NextResponse.json({ error: back.error.message }, { status: 500 });
  const { error } = await supabaseAdmin.from("passport_signoffs").delete().eq("patient_id", id).eq("taken_on", taken_on);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
