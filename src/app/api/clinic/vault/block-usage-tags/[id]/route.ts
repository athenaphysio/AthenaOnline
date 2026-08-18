import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as { name?: string };

  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  try {
    const { error } = await supabaseAdmin.from("block_usage_tags").update({ name: body.name.trim() }).eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ id });
  } catch (err) {
    console.error("rename block usage tag failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Rename failed: ${detail}` }, { status: 500 });
  }
}

// block_usage_tag_links has on delete cascade, so removing a tag untags it
// from every block automatically -- the confirmation that this is really
// what David wants happens client-side (the manager page shows the real
// usage count before this is ever called), not here.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { error } = await supabaseAdmin.from("block_usage_tags").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ id });
  } catch (err) {
    console.error("delete block usage tag failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Delete failed: ${detail}` }, { status: 500 });
  }
}
