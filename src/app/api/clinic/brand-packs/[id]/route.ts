import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getBrandPack, getBrandPackUsage } from "@/lib/brandPack";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const [pack, usage] = await Promise.all([getBrandPack(id), getBrandPackUsage(id)]);
    if (!pack) return NextResponse.json({ error: "Pack not found." }, { status: 404 });
    return NextResponse.json({ pack, usage });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to load: ${detail}` }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as {
    name?: string;
    accent_color?: string;
    background_color?: string;
  };

  try {
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("brand_packs")
      .select("is_default, name")
      .eq("id", id)
      .maybeSingle<{ is_default: boolean; name: string }>();
    if (fetchError) throw new Error(fetchError.message);
    if (!existing) return NextResponse.json({ error: "Pack not found." }, { status: 404 });

    const update: Record<string, string> = {};
    if (body.name !== undefined) {
      const trimmed = body.name.trim();
      if (!trimmed) return NextResponse.json({ error: "Name is required." }, { status: 400 });
      // The permanent fallback pack keeps its name -- confirmed in the
      // brief ("no deleting or renaming the default pack"), so this is
      // silently a no-op on the name rather than an error if it happens
      // to match what's already there, and a real error otherwise.
      if (existing.is_default && trimmed !== existing.name) {
        return NextResponse.json({ error: "The default pack can't be renamed." }, { status: 400 });
      }
      update.name = trimmed;
    }
    if (body.accent_color !== undefined) update.accent_color = body.accent_color.trim();
    if (body.background_color !== undefined) update.background_color = body.background_color.trim();

    if (Object.keys(update).length > 0) {
      const { error } = await supabaseAdmin.from("brand_packs").update(update).eq("id", id);
      if (error) throw new Error(error.message);
    }

    return NextResponse.json({ id });
  } catch (err) {
    console.error("update brand pack failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Update failed: ${detail}` }, { status: 500 });
  }
}

// on delete set null on both programmes.brand_pack_id and
// patients.brand_pack_id (0082_brand_packs.sql) means the actual unassign
// happens for free at the database level -- this route's own job is just
// refusing to delete the default pack at all, defence in depth alongside
// the builder screen never showing the option.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("brand_packs")
      .select("is_default")
      .eq("id", id)
      .maybeSingle<{ is_default: boolean }>();
    if (fetchError) throw new Error(fetchError.message);
    if (!existing) return NextResponse.json({ error: "Pack not found." }, { status: 404 });
    if (existing.is_default) {
      return NextResponse.json({ error: "The default pack can't be deleted -- it's the permanent fallback." }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("brand_packs").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ id });
  } catch (err) {
    console.error("delete brand pack failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Delete failed: ${detail}` }, { status: 500 });
  }
}
