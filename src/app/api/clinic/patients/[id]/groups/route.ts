import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Replaces this one patient's full group membership set in one call --
// same delete-then-insert-fresh pattern already used for programme_workouts
// on programme save (src/app/api/clinic/programmes/[id]/route.ts). Used by
// the patient record page's own Groups editor, which has no separate save
// step -- every checkbox toggle sends the new full set immediately.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: patientId } = await params;
  const body = await request.json();
  const { group_ids } = body as { group_ids: string[] };

  if (!Array.isArray(group_ids)) {
    return NextResponse.json({ error: "group_ids must be an array." }, { status: 400 });
  }

  try {
    const { error: deleteError } = await supabaseAdmin
      .from("patient_group_members")
      .delete()
      .eq("patient_id", patientId);
    if (deleteError) throw new Error(deleteError.message);

    if (group_ids.length > 0) {
      const rows = group_ids.map((groupId) => ({ patient_id: patientId, group_id: groupId }));
      const { error: insertError } = await supabaseAdmin.from("patient_group_members").insert(rows);
      if (insertError) throw new Error(insertError.message);
    }

    return NextResponse.json({ group_ids });
  } catch (err) {
    console.error("update patient groups failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Update failed: ${detail}` }, { status: 500 });
  }
}
