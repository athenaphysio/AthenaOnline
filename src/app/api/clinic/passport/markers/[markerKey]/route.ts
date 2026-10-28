import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";

// The plain English explanation of a marker, written once in the clinic and
// shown to every client who has that marker.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ markerKey: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { markerKey } = await params;
  const { explanation } = (await request.json()) as { explanation?: string | null };
  const { error } = await supabaseAdmin
    .from("passport_markers")
    .update({ explanation: explanation?.trim() || null, updated_at: new Date().toISOString() })
    .eq("marker_key", decodeURIComponent(markerKey));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ marker_key: markerKey });
}
