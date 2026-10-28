import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";

// Add or change the clinician note on one result, and release it to the
// client (or take it back to draft). Releasing is the only way a client
// ever sees a result.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ resultId: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { resultId } = await params;
  const body = (await request.json()) as { clinician_note?: string | null; status?: "draft" | "released" };

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.clinician_note !== undefined) update.clinician_note = body.clinician_note?.trim() || null;
  if (body.status !== undefined) {
    if (body.status !== "draft" && body.status !== "released") {
      return NextResponse.json({ error: "status must be draft or released." }, { status: 400 });
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
