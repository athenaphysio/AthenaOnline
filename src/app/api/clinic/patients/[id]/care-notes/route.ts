import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";
import { SECTIONS } from "@/lib/clinicianAccess";

// A care team note written by Dr David Silver PhD from the clinic.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: patientId } = await params;
  const { section, body, package_id } = (await request.json()) as { section?: string; body?: string; package_id?: string | null };
  if (!section || !SECTIONS.some((s) => s.key === section && s.key !== "write_notes") || !body?.trim()) {
    return NextResponse.json({ error: "A section and a note are required." }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from("care_notes").insert({
    patient_id: patientId,
    package_id: package_id ?? null,
    section,
    staff_id: null,
    author_name: "Dr David Silver PhD",
    body: body.trim().slice(0, 5000),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
