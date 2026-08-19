import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getBrandPackCatalog } from "@/lib/brandPack";

export async function GET() {
  try {
    const packs = await getBrandPackCatalog();
    return NextResponse.json({ packs });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to load: ${detail}` }, { status: 500 });
  }
}

// Only name and the two colours are required -- every image field starts
// null and gets filled in through the per-component upload endpoint once
// the pack itself exists. is_default is never settable here: the one
// default row is seeded by migration and never touched by this route.
export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    id?: string;
    name?: string;
    accent_color?: string;
    background_color?: string;
  };

  const name = body.name?.trim();
  const accentColor = body.accent_color?.trim();
  const backgroundColor = body.background_color?.trim();

  if (!name || !accentColor || !backgroundColor) {
    return NextResponse.json({ error: "Name and both colours are required." }, { status: 400 });
  }

  try {
    // Client-generated id, same pattern as blocks/friends/exercises --
    // lets an image upload target this pack's storage path immediately
    // after this first save, before any further edits happen.
    const { data, error } = await supabaseAdmin
      .from("brand_packs")
      .insert({ ...(body.id ? { id: body.id } : {}), name, accent_color: accentColor, background_color: backgroundColor })
      .select("id")
      .single<{ id: string }>();
    if (error) throw new Error(error.message);
    return NextResponse.json({ id: data.id });
  } catch (err) {
    console.error("create brand pack failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Create failed: ${detail}` }, { status: 500 });
  }
}
