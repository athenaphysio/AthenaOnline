import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Bulk-add only -- used by the main patient list's "N selected -> Add to
// group" action. Never touches a patient's existing memberships in other
// groups; duplicates (already a member) are silently ignored rather than
// erroring, since re-adding someone already in the group is a no-op, not a
// mistake worth surfacing.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await params;
  const body = await request.json();
  const { patient_ids } = body as { patient_ids: string[] };

  if (!Array.isArray(patient_ids) || patient_ids.length === 0) {
    return NextResponse.json({ error: "patient_ids is required." }, { status: 400 });
  }

  try {
    const rows = patient_ids.map((patientId) => ({ patient_id: patientId, group_id: groupId }));
    const { error } = await supabaseAdmin
      .from("patient_group_members")
      .upsert(rows, { onConflict: "patient_id,group_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);

    return NextResponse.json({ added: patient_ids.length });
  } catch (err) {
    console.error("bulk add to group failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Add failed: ${detail}` }, { status: 500 });
  }
}
