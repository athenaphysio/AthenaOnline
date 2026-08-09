import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type IncomingWeek = {
  week_number: number;
  exercise_id: string;
  rationale: string;
  sets: number | null;
  reps: number | null;
  hold_seconds: number | null;
  percent_max: number | null;
  frequency: string | null;
};

type IncomingItem = {
  item_order: number;
  weeks: IncomingWeek[];
};

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { id, name, type, block_length_weeks, items, ai_draft, notes } = body as {
    id: string;
    name: string;
    type: string;
    block_length_weeks: number;
    items: IncomingItem[];
    ai_draft: { block: string; assumptions: string[]; confirmations: string[]; created_at: string } | null;
    notes?: string | null;
  };

  // items.length === 0 is allowed: a block can be created empty (e.g. the
  // "+ New block" flow inside the Workout Builder) and populated afterwards.
  if (!id || !name || !type || !block_length_weeks || !Array.isArray(items)) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  try {
    const { error: blockError } = await supabaseAdmin.from("blocks").insert({ id, name, type, block_length_weeks });
    if (blockError) throw new Error(blockError.message);

    // ai_draft lives in its own table, never granted to any role but
    // service_role -- see 0014_clinical_notes_split.sql. notes lives
    // alongside it for the same reason (kept out of the coach-readable
    // blocks row), but is written directly by David rather than generated.
    if (ai_draft) {
      const { error: notesError } = await supabaseAdmin.from("block_notes").insert({
        block_id: id,
        ai_draft,
        ai_draft_created_at: ai_draft.created_at ?? null,
        notes: notes ?? null,
      });
      if (notesError) throw new Error(notesError.message);
    } else if (notes) {
      const { error: notesError } = await supabaseAdmin.from("block_notes").insert({ block_id: id, notes });
      if (notesError) throw new Error(notesError.message);
    }

    for (const item of items) {
      const { data: insertedItem, error: itemError } = await supabaseAdmin
        .from("block_items")
        .insert({ block_id: id, item_order: item.item_order })
        .select("id")
        .single();
      if (itemError) throw new Error(itemError.message);

      const weekRows = item.weeks.map((w) => ({
        block_item_id: insertedItem.id,
        week_number: w.week_number,
        exercise_id: w.exercise_id,
        rationale: w.rationale,
        sets: w.sets,
        reps: w.reps,
        hold_seconds: w.hold_seconds,
        percent_max: w.percent_max,
        frequency: w.frequency,
      }));
      const { error: weeksError } = await supabaseAdmin.from("block_item_weeks").insert(weekRows);
      if (weeksError) throw new Error(weeksError.message);
    }

    return NextResponse.json({ id });
  } catch (err) {
    console.error("create block failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Create failed: ${detail}` }, { status: 500 });
  }
}
