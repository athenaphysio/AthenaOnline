import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";

// David's switch for the Human Passport on one client. Off by default, so
// no client sees My Passport until it is turned on here.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { enabled } = (await request.json()) as { enabled?: boolean };
  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be a boolean." }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from("patients").update({ passport_enabled: enabled }).eq("id", id);
  if (error) {
    console.error("update passport_enabled failed", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id, enabled });
}
