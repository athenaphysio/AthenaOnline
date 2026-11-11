import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";

// Add or change the clinician note on one result, and release it to the
// client (or take it back to draft). Releasing is the only way a client
// ever sees a result.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ resultId: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { resultId } = await params;
  const body = (await request.json()) as {
    clinician_note?: string | null;
    status?: "draft" | "released";
    value?: number;
    taken_on?: string;
    timepoint?: string;
    range_low?: number | null;
    range_high?: number | null;
  };

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  // Correcting the reading itself.
  if (body.value !== undefined) {
    if (typeof body.value !== "number" || !Number.isFinite(body.value)) {
      return NextResponse.json({ error: "The value must be a number." }, { status: 400 });
    }
    update.value = body.value;
  }
  if (body.taken_on !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.taken_on)) return NextResponse.json({ error: "The date should look like 2026-11-05." }, { status: 400 });
    update.taken_on = body.taken_on;
  }
  if (body.timepoint !== undefined) {
    if (!["baseline", "month_3", "month_6", "review"].includes(body.timepoint)) {
      return NextResponse.json({ error: "Unknown timepoint." }, { status: 400 });
    }
    update.timepoint = body.timepoint;
  }
  // This client's own reference range, as printed on their report.
  for (const key of ["range_low", "range_high"] as const) {
    const v = body[key];
    if (v === undefined) continue;
    if (v !== null && (typeof v !== "number" || !Number.isFinite(v))) {
      return NextResponse.json({ error: "A range limit must be a number, or left empty." }, { status: 400 });
    }
    update[key] = v;
  }
  if (body.clinician_note !== undefined) update.clinician_note = body.clinician_note?.trim() || null;
  if (body.status !== undefined) {
    if (body.status !== "draft" && body.status !== "released") {
      return NextResponse.json({ error: "status must be draft or released." }, { status: 400 });
    }
    if (body.status === "released") {
      // Nothing reaches a client until its test date has been signed off at
      // a multidisciplinary meeting.
      const { data: result } = await supabaseAdmin
        .from("passport_results")
        .select("patient_id, taken_on")
        .eq("id", resultId)
        .maybeSingle<{ patient_id: string; taken_on: string }>();
      if (!result) return NextResponse.json({ error: "That result wasn't found." }, { status: 404 });
      const takenOn = (update.taken_on as string | undefined) ?? result.taken_on;
      const { data: signoff } = await supabaseAdmin
        .from("passport_signoffs")
        .select("id")
        .eq("patient_id", result.patient_id)
        .eq("taken_on", takenOn)
        .maybeSingle<{ id: string }>();
      if (!signoff) {
        return NextResponse.json(
          { error: `Results from ${takenOn} have not been signed off at a multidisciplinary meeting yet, so they cannot be released.` },
          { status: 409 }
        );
      }
    }
    update.status = body.status;
    update.released_at = body.status === "released" ? new Date().toISOString() : null;
  }

  const { error } = await supabaseAdmin.from("passport_results").update(update).eq("id", resultId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: resultId });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ resultId: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { resultId } = await params;
  const { error } = await supabaseAdmin.from("passport_results").delete().eq("id", resultId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: resultId });
}
