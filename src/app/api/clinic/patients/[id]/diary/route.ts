import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { revokeLink } from "@/lib/diaryServer";
import { cleanSlotLocation } from "@/lib/diary";

// David's controls for one client's diary planner: the on and off switch,
// the equipment at each place they train, and revoking a PA's link.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as { enabled?: unknown; location?: unknown; equipmentIds?: unknown };

  if (typeof body.enabled === "boolean") {
    const { error } = await supabaseAdmin.from("patients").update({ diary_planner_enabled: body.enabled }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (body.location !== undefined) {
    const location = cleanSlotLocation(body.location);
    const ids = Array.isArray(body.equipmentIds) ? body.equipmentIds.filter((x): x is string => typeof x === "string") : null;
    if (!location || !ids) return NextResponse.json({ error: "A location and a list of equipment are needed." }, { status: 400 });
    const { error } = await supabaseAdmin
      .from("diary_location_equipment")
      .upsert({ patient_id: id, location, equipment_ids: ids, updated_at: new Date().toISOString() });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { linkId } = (await request.json()) as { linkId?: unknown };
  if (!(await revokeLink(id, linkId))) return NextResponse.json({ error: "The link couldn't be switched off." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
