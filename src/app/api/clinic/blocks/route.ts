import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cleanDesignations } from "@/lib/designations";
import { cleanPrescriptionMode } from "@/lib/prescriptionMode";
import { parseUsageTagIds, syncBlockUsageTags } from "@/lib/blockUsageTags";

type IncomingWeek = {
  week_number: number;
  exercise_id: string;
  rationale: string;
  sets: number | null;
  reps: number | null;
  hold_seconds: number | null;
  percent_max: number | null;
  frequency: string | null;
  prescription_mode?: string | null;
};

type IncomingItem = {
  item_order: number;
  weeks: IncomingWeek[];
};

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { id, name, type, block_length_weeks, items, ai_draft, notes, phase_id, condition_use_case, contraindication_flags, sequence_type, designations } =
    body as {
      id: string;
      name: string;
      type: string;
      block_length_weeks: number;
      items: IncomingItem[];
      ai_draft: { block: string; assumptions: string[]; confirmations: string[]; created_at: string } | null;
      notes?: string | null;
      phase_id?: string | null;
      condition_use_case?: string | null;
      contraindication_flags?: string | null;
      sequence_type?: string;
      designations?: string[];
      usage_tag_ids?: string[];
    };

  const usageTagIds = parseUsageTagIds(body);

  // items.length === 0 is allowed: a block can be created empty (e.g. the
  // "+ New block" flow inside the Workout Builder) and populated afterwards.
  if (!id || !name || !type || !block_length_weeks || !Array.isArray(items)) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  try {
    const { error: blockError } = await supabaseAdmin
      .from("blocks")
      .insert({
        id,
        name,
        type,
        block_length_weeks,
        phase_id: phase_id ?? null,
        sequence_type: sequence_type ?? "straight_sets",
        designations: cleanDesignations(designations),
      });
    if (blockError) throw new Error(blockError.message);

    // ai_draft lives in its own table, never granted to any role but
    // service_role -- see 0014_clinical_notes_split.sql. notes, indication
    // and contraindication live alongside it for the same reason (kept out
    // of the coach-readable blocks row), but are written directly by David
    // rather than generated.
    const hasClinicianNotes = Boolean(notes || condition_use_case || contraindication_flags);
    if (ai_draft || hasClinicianNotes) {
      const { error: notesError } = await supabaseAdmin.from("block_notes").insert({
        block_id: id,
        ai_draft: ai_draft ?? null,
        ai_draft_created_at: ai_draft?.created_at ?? null,
        notes: notes ?? null,
        condition_use_case: condition_use_case ?? null,
        contraindication_flags: contraindication_flags ?? null,
      });
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
        prescription_mode: cleanPrescriptionMode(w.prescription_mode),
      }));
      const { error: weeksError } = await supabaseAdmin.from("block_item_weeks").insert(weekRows);
      if (weeksError) throw new Error(weeksError.message);
    }

    await syncBlockUsageTags(id, usageTagIds);

    return NextResponse.json({ id });
  } catch (err) {
    console.error("create block failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Create failed: ${detail}` }, { status: 500 });
  }
}
