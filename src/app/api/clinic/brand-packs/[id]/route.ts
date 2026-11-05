import { linkSlug, normaliseAppLayout } from "@/lib/appLayout";
import { isBrandHeadingFont } from "@/lib/brandFonts";
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
    theme?: string;
    heading_font?: string | null;
    app_layout?: unknown;
    guide_title?: string | null;
    guide_body?: string | null;
    guide_required?: boolean;
  };

  if (body.theme !== undefined && body.theme !== "light" && body.theme !== "dark") {
    return NextResponse.json({ error: "Page style must be light or dark." }, { status: 400 });
  }
  if (body.heading_font !== undefined && body.heading_font !== null && !isBrandHeadingFont(body.heading_font)) {
    return NextResponse.json({ error: "That heading font is not one the app offers." }, { status: 400 });
  }

  try {
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("brand_packs")
      .select("is_default, name")
      .eq("id", id)
      .maybeSingle<{ is_default: boolean; name: string }>();
    if (fetchError) throw new Error(fetchError.message);
    if (!existing) return NextResponse.json({ error: "Pack not found." }, { status: 404 });

    const update: Record<string, unknown> = {};
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
    if (body.theme !== undefined) update.theme = body.theme;
    if (body.heading_font !== undefined) update.heading_font = body.heading_font;
    // Stored in its tidied form, so only recognised settings are kept.
    if (body.app_layout !== undefined) {
      const layout = normaliseAppLayout(body.app_layout);
      // Two packs answering to the same link would send clients to the
      // wrong brand, so a link name already in use by another pack, as its
      // own link name or as its name, is refused.
      if (layout.link_name) {
        const { data: others } = await supabaseAdmin
          .from("brand_packs")
          .select("id, name, app_layout")
          .neq("id", id)
          .returns<{ id: string; name: string; app_layout: unknown }[]>();
        const clash = (others ?? []).find(
          (o) => normaliseAppLayout(o.app_layout).link_name === layout.link_name || linkSlug(o.name) === layout.link_name,
        );
        if (clash) {
          return NextResponse.json({ error: `The link name "${layout.link_name}" is already used by ${clash.name}. Please choose another.` }, { status: 400 });
        }
      }
      update.app_layout = layout;
    }

    if (body.guide_title !== undefined) update.guide_title = body.guide_title?.trim() || null;
    if (body.guide_body !== undefined) update.guide_body = body.guide_body?.trim() ? body.guide_body : null;
    if (body.guide_required !== undefined) update.guide_required = body.guide_required === true;

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
