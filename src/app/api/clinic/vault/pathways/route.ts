import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validatePathway } from "@/lib/pathways";

// Paste in a pathway from the Clinical Pathways Project. A pathway with the
// same name is updated in place rather than added twice, so pasting a
// revised version replaces the old one and keeps its link.
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { code?: unknown };
  const result = validatePathway(body.code);
  if (!result.valid) return NextResponse.json({ errors: result.errors }, { status: 400 });
  const p = result.pathway;

  const { data: existing } = await supabaseAdmin
    .from("pathways")
    .select("id")
    .ilike("name", p.name)
    .maybeSingle<{ id: string }>();

  const row = { name: p.name, region: p.region, pathology: p.pathology, definition: p, updated_at: new Date().toISOString() };
  if (existing) {
    const { error } = await supabaseAdmin.from("pathways").update(row).eq("id", existing.id);
    if (error) return NextResponse.json({ errors: [error.message] }, { status: 500 });
    return NextResponse.json({ id: existing.id, replaced: true });
  }
  const { data, error } = await supabaseAdmin.from("pathways").insert(row).select("id").single<{ id: string }>();
  if (error) return NextResponse.json({ errors: [error.message] }, { status: 500 });
  return NextResponse.json({ id: data.id, replaced: false });
}
