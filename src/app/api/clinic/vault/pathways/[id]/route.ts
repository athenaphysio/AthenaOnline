import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validatePathway } from "@/lib/pathways";

// Saves edits made in the pathway editor: the whole definition, and
// whether the pathway is approved for building client programmes.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { definition?: unknown; status?: unknown };

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.definition !== undefined) {
    const result = validatePathway(body.definition);
    if (!result.valid) return NextResponse.json({ errors: result.errors }, { status: 400 });
    const p = result.pathway;
    Object.assign(update, { definition: p, name: p.name, region: p.region, pathology: p.pathology });
  }
  if (body.status !== undefined) {
    if (body.status !== "draft" && body.status !== "approved") return NextResponse.json({ errors: ["Unknown status."] }, { status: 400 });
    update.status = body.status;
  }

  const { error } = await supabaseAdmin.from("pathways").update(update).eq("id", id);
  if (error) return NextResponse.json({ errors: [error.message] }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// A pathway already used for a client cannot be deleted, so the record of
// how that client's programme was built stays intact.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { count } = await supabaseAdmin
    .from("pathway_assignments")
    .select("id", { count: "exact", head: true })
    .eq("pathway_id", id);
  if ((count ?? 0) > 0) {
    return NextResponse.json({ errors: ["This pathway has been used for a client, so it can't be deleted. Set it back to draft instead."] }, { status: 409 });
  }
  const { error } = await supabaseAdmin.from("pathways").delete().eq("id", id);
  if (error) return NextResponse.json({ errors: [error.message] }, { status: 500 });
  return NextResponse.json({ ok: true });
}
