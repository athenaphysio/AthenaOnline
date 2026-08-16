import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type BlockItemRow = {
  item_order: number;
  block_item_weeks: { week_number: number; exercises: { name_clinical: string } | null }[];
};

type BlockRow = {
  id: string;
  name: string;
  type: string;
  block_length_weeks: number;
  block_items: BlockItemRow[];
};

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const type = request.nextUrl.searchParams.get("type")?.trim() ?? "";

  let query = supabaseAdmin
    .from("blocks")
    .select(
      "id, name, type, block_length_weeks, block_items(item_order, block_item_weeks(week_number, exercises(name_clinical)))"
    )
    .order("name")
    .limit(30);

  if (q) query = query.ilike("name", `%${q}%`);
  if (type) query = query.eq("type", type);

  const { data, error } = await query.returns<BlockRow[]>();
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
    return { id: b.id, name: b.name, type: b.type, block_length_weeks: b.block_length_weeks, drillNames };
  });

  return NextResponse.json({ blocks });
}
