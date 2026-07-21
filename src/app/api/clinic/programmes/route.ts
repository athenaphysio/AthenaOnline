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
  const { id, patient_first_name, title, block_length_weeks, audio_url, items, ai_draft } = body as {
    id: string;
    patient_first_name: string;
    title: string;
    block_length_weeks: number;
    audio_url: string | null;
    items: IncomingItem[];
    ai_draft: { block: string; assumptions: string[]; confirmations: string[]; created_at: string } | null;
  };

  if (!id || !patient_first_name || !title || !block_length_weeks || !Array.isArray(items)) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  try {
    const { data: programme, error: programmeError } = await supabaseAdmin
      .from("programmes")
      .insert({
        id,
        patient_first_name,
        title,
        block_length_weeks,
        audio_url: audio_url ?? null,
        ai_draft: ai_draft ?? null,
        ai_draft_created_at: ai_draft?.created_at ?? null,
      })
      .select("share_code")
      .single();

    if (programmeError) throw new Error(programmeError.message);

    for (const item of items) {
      const { data: insertedItem, error: itemError } = await supabaseAdmin
        .from("programme_items")
        .insert({ programme_id: id, item_order: item.item_order })
        .select("id")
        .single();

      if (itemError) throw new Error(itemError.message);

      const weekRows = item.weeks.map((w) => ({
        programme_item_id: insertedItem.id,
        week_number: w.week_number,
        exercise_id: w.exercise_id,
        rationale: w.rationale,
        sets: w.sets,
        reps: w.reps,
        hold_seconds: w.hold_seconds,
        percent_max: w.percent_max,
        frequency: w.frequency,
      }));

      const { error: weeksError } = await supabaseAdmin.from("programme_item_weeks").insert(weekRows);
      if (weeksError) throw new Error(weeksError.message);
    }

    return NextResponse.json({ share_code: programme.share_code });
  } catch (err) {
    console.error("create programme failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Create failed: ${detail}` }, { status: 500 });
  }
}
