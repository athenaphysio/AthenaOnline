import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cleanDesignations } from "@/lib/designations";
import { getBlockUsageTagMap } from "@/lib/blockUsageTags";

type BlockItemRow = {
  item_order: number;
  block_item_weeks: { week_number: number; exercises: { name_clinical: string } | null }[];
};

type BlockRow = {
  id: string;
  name: string;
  type: string;
  block_length_weeks: number;
  designations: string[] | null;
  block_items: BlockItemRow[];
};

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const type = request.nextUrl.searchParams.get("type")?.trim() ?? "";
  // "Show me everything marked HIIT" -- contains, so a block tagged both
  // HIIT and Cardio still matches either.
  const designation = request.nextUrl.searchParams.get("designation")?.trim() ?? "";
  const usageTag = request.nextUrl.searchParams.get("usage_tag")?.trim() ?? "";

  let query = supabaseAdmin
    .from("blocks")
    .select(
      "id, name, type, block_length_weeks, designations, block_items(item_order, block_item_weeks(week_number, exercises(name_clinical)))"
    )
    .order("name")
    .limit(30);

  if (q) query = query.ilike("name", `%${q}%`);
  if (type) query = query.eq("type", type);
  if (designation) query = query.contains("designations", [designation]);

  // Usage tags live in a join table (many-to-many, unlike designations'
  // plain array column), so the filter is a separate lookup of matching
  // block ids rather than something the main query can express directly.
  if (usageTag) {
    const { data: linkRows, error: linkError } = await supabaseAdmin
      .from("block_usage_tag_links")
      .select("block_id")
      .eq("tag_id", usageTag)
      .returns<{ block_id: string }[]>();
    if (linkError) {
      return NextResponse.json({ error: linkError.message }, { status: 500 });
    }
    const blockIds = linkRows.map((l) => l.block_id);
    if (blockIds.length === 0) {
      return NextResponse.json({ blocks: [] });
    }
    query = query.in("id", blockIds);
  }

  const [{ data, error }, usageTagMap] = await Promise.all([query.returns<BlockRow[]>(), getBlockUsageTagMap()]);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Drill names only, week 1 -- see the Phase 2 brief's "quick drill list":
  // fast to scan in the library, not another detail screen, so no
  // sets/reps/video/notes travel with this at all.
  const blocks = (data ?? []).map((b) => {
    const items = [...b.block_items].sort((x, y) => x.item_order - y.item_order);
    const drillNames = items
      .map((item) => {
        const week1 = item.block_item_weeks.find((w) => w.week_number === 1) ?? item.block_item_weeks[0];
        return week1?.exercises?.name_clinical ?? null;
      })
      .filter((n): n is string => Boolean(n));
    return {
      id: b.id,
      name: b.name,
      type: b.type,
      block_length_weeks: b.block_length_weeks,
      designations: cleanDesignations(b.designations),
      usage_tag_ids: usageTagMap.get(b.id) ?? [],
      drillNames,
    };
  });

  return NextResponse.json({ blocks });
}
