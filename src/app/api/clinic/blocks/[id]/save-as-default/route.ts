import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";

type WeekRow = {
  week_number: number;
  exercise_id: string;
  rationale: string | null;
  sets: number | null;
  reps: number | null;
  hold_seconds: number | null;
  percent_max: number | null;
  frequency: string | null;
  prescription_mode: string | null;
};

// "Save as default": a client's copy of a block becomes the new version of
// the library block it came from, so the next client starts from it. Only
// the exercises and their prescriptions are copied across; the library
// block keeps its own name, phase, tags and notes.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { data: copy, error } = await supabaseAdmin
    .from("blocks")
    .select(
      "id, source_block_id, block_length_weeks, block_items(item_order, block_item_weeks(week_number, exercise_id, rationale, sets, reps, hold_seconds, percent_max, frequency, prescription_mode))"
    )
    .eq("id", id)
    .maybeSingle<{ id: string; source_block_id: string | null; block_length_weeks: number; block_items: { item_order: number; block_item_weeks: WeekRow[] }[] }>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!copy?.source_block_id) return NextResponse.json({ error: "This block is not a client copy of a library block." }, { status: 400 });

  const { data: source } = await supabaseAdmin.from("blocks").select("id, name").eq("id", copy.source_block_id).maybeSingle<{ id: string; name: string }>();
  if (!source) return NextResponse.json({ error: "The library block it came from no longer exists." }, { status: 404 });

  const { error: deleteError } = await supabaseAdmin.from("block_items").delete().eq("block_id", source.id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  const items = [...copy.block_items].sort((a, b) => a.item_order - b.item_order);
  for (let i = 0; i < items.length; i++) {
    const { data: newItem, error: itemError } = await supabaseAdmin
      .from("block_items")
      .insert({ block_id: source.id, item_order: i + 1 })
      .select("id")
      .single<{ id: string }>();
    if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 });
    const weeks = items[i].block_item_weeks.map((w) => ({ block_item_id: newItem.id, ...w }));
    if (weeks.length > 0) {
      const { error: weeksError } = await supabaseAdmin.from("block_item_weeks").insert(weeks);
      if (weeksError) return NextResponse.json({ error: weeksError.message }, { status: 500 });
    }
  }

  await supabaseAdmin
    .from("blocks")
    .update({ block_length_weeks: copy.block_length_weeks, updated_at: new Date().toISOString() })
    .eq("id", source.id);

  return NextResponse.json({ ok: true, name: source.name });
}
