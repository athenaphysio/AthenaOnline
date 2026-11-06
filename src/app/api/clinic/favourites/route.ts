import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { FAVOURITE_TYPES, type FavouriteType } from "@/lib/favouriteTypes";

// Starred library items (see 0129_library_favourites.sql). GET lists them
// all; POST stars or unstars one item.

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("library_favourites")
    .select("item_type, item_id")
    .returns<{ item_type: FavouriteType; item_id: string }[]>();
  if (error) {
    console.error("list favourites failed", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ favourites: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { item_type, item_id, favourite } = (await request.json()) as {
    item_type?: string;
    item_id?: string;
    favourite?: boolean;
  };
  if (!item_type || !FAVOURITE_TYPES.includes(item_type as FavouriteType) || !item_id || typeof favourite !== "boolean") {
    return NextResponse.json({ error: "item_type, item_id and favourite are required." }, { status: 400 });
  }

  const { error } = favourite
    ? await supabaseAdmin.from("library_favourites").upsert({ item_type, item_id }, { onConflict: "item_type,item_id" })
    : await supabaseAdmin.from("library_favourites").delete().eq("item_type", item_type).eq("item_id", item_id);
  if (error) {
    console.error("update favourite failed", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
