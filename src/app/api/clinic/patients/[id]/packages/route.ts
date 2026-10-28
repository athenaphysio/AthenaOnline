import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";

// Put a client in a package, or take them out. Taking a client out removes
// every clinician's access through that package at once.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: patientId } = await params;
  const { package_id, member } = (await request.json()) as { package_id?: string; member?: boolean };
  if (!package_id || typeof member !== "boolean") {
    return NextResponse.json({ error: "package_id and member are required." }, { status: 400 });
  }
  const result = member
    ? await supabaseAdmin
        .from("patient_packages")
        .upsert({ patient_id: patientId, package_id }, { onConflict: "patient_id,package_id", ignoreDuplicates: true })
    : await supabaseAdmin.from("patient_packages").delete().match({ patient_id: patientId, package_id });
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
