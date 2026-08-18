import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cleanDesignations } from "@/lib/designations";
import { cleanPrescriptionMode } from "@/lib/prescriptionMode";
import { parseUsageTagIds, syncBlockUsageTags } from "@/lib/blockUsageTags";
import { getBlockUsageMap } from "@/lib/blockUsage";

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

type BlockItemWeekRow = {
  week_number: number;
  exercise_id: string;
  rationale: string | null;
  sets: number | null;
  reps: number | null;
  hold_seconds: number | null;
  percent_max: number | null;
  frequency: string | null;
  prescription_mode: string | null;
  exercises: { name_clinical: string };
};

type BlockItemRow = {
  id: string;
  item_order: number;
  block_item_weeks: BlockItemWeekRow[];
};

type BlockRow = {
  id: string;
  name: string;
  type: string;
  block_length_weeks: number;
  sequence_type: string;
  designations: string[] | null;
  block_items: BlockItemRow[];
};

// Fetches one block's own exercises + per-week prescriptions -- used when a
// clinician adds an existing block from the library into a Workout, so it
// can expand inline (via BlockGroupEditor) instead of staying an opaque
// reference. Same shape blocks/[id]/page.tsx already assembles server-side.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [blockRes, notesRes, usageTagLinksRes] = await Promise.all([
    supabaseAdmin
      .from("blocks")
      .select(
        "id, name, type, block_length_weeks, sequence_type, designations, block_items(id, item_order, block_item_weeks(week_number, exercise_id, rationale, sets, reps, hold_seconds, percent_max, frequency, prescription_mode, exercises(name_clinical)))"
      )
      .eq("id", id)
      .maybeSingle<BlockRow>(),
    supabaseAdmin.from("block_notes").select("notes").eq("block_id", id).maybeSingle<{ notes: string | null }>(),
    supabaseAdmin.from("block_usage_tag_links").select("tag_id").eq("block_id", id).returns<{ tag_id: string }[]>(),
  ]);
  const { data: block, error } = blockRes;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!block) {
    return NextResponse.json({ error: "Block not found." }, { status: 404 });
  }

  const sortedItems = [...block.block_items].sort((a, b) => a.item_order - b.item_order);

  return NextResponse.json({
    id: block.id,
    name: block.name,
    type: block.type,
    block_length_weeks: block.block_length_weeks,
    sequence_type: block.sequence_type,
    designations: cleanDesignations(block.designations),
    usage_tag_ids: (usageTagLinksRes.data ?? []).map((l) => l.tag_id),
    notes: notesRes.data?.notes ?? null,
    items: sortedItems.map((item) => ({
      key: item.id,
      weeks: [...item.block_item_weeks]
        .sort((a, b) => a.week_number - b.week_number)
        .map((w) => ({
          week_number: w.week_number,
          exercise_id: w.exercise_id,
          name: w.exercises.name_clinical,
          rationale: w.rationale ?? "",
          sets: w.sets,
          reps: w.reps,
          hold_seconds: w.hold_seconds,
          percent_max: w.percent_max,
          frequency: w.frequency,
          prescription_mode: cleanPrescriptionMode(w.prescription_mode),
        })),
    })),
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { name, type, block_length_weeks, items, notes, phase_id, condition_use_case, contraindication_flags, sequence_type, designations } =
    body as {
      name: string;
      type: string;
      block_length_weeks: number;
      items: IncomingItem[];
      notes?: string | null;
      phase_id?: string | null;
      condition_use_case?: string | null;
      contraindication_flags?: string | null;
      sequence_type?: string;
      designations?: string[];
      usage_tag_ids?: string[];
    };

  // items.length === 0 is allowed -- see the matching note in the POST route.
  if (!name || !type || !block_length_weeks || !Array.isArray(items)) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  try {
    const { error: blockError } = await supabaseAdmin
      .from("blocks")
      .update({
        name,
        type,
        block_length_weeks,
        phase_id: phase_id ?? null,
        ...(sequence_type ? { sequence_type } : {}),
        ...(designations !== undefined ? { designations: cleanDesignations(designations) } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (blockError) throw new Error(blockError.message);

    // Replace all items/weeks fresh rather than diffing individual rows,
    // same pattern used for programmes -- the ai_draft columns are never
    // touched by this route.
    const { error: deleteError } = await supabaseAdmin.from("block_items").delete().eq("block_id", id);
    if (deleteError) throw new Error(deleteError.message);

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

    // Undefined (not sent at all) means "leave tags alone" -- BlockGroupEditor's
    // inline save from inside the Workout Builder PATCHes a referenced
    // block's prescriptions without knowing anything about usage tags, and
    // that must not silently wipe them. Only the block editors that actually
    // show the tag picker (BlockBuilder, VaultBlockBuilder) send this field.
    if (body.usage_tag_ids !== undefined) {
      await syncBlockUsageTags(id, parseUsageTagIds(body));
    }

    if (notes !== undefined || condition_use_case !== undefined || contraindication_flags !== undefined) {
      const { error: notesError } = await supabaseAdmin.from("block_notes").upsert({
        block_id: id,
        ...(notes !== undefined ? { notes: notes || null } : {}),
        ...(condition_use_case !== undefined ? { condition_use_case: condition_use_case || null } : {}),
        ...(contraindication_flags !== undefined ? { contraindication_flags: contraindication_flags || null } : {}),
      });
      if (notesError) throw new Error(notesError.message);
    }

    return NextResponse.json({ id });
  } catch (err) {
    console.error("update block failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Update failed: ${detail}` }, { status: 500 });
  }
}

// workout_items.block_id has no cascade or set-null (0009_content_hierarchy.sql),
// so the database itself refuses this delete outright while any workout
// still references the block -- a block is shared content, and silently
// ripping it out of workouts it's actually used in is never the right
// call. The pre-check here exists only to give a specific, real-patient-
// aware error rather than a bare Postgres FK message; BlocksListClient and
// BlocksLibraryClient never even show the delete button once usage is
// non-zero, so reaching this branch means something changed underneath
// the page between load and click.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const usage = (await getBlockUsageMap()).get(id);
    if (usage && usage.workoutCount > 0) {
      const patientPart =
        usage.patientNames.length > 0
          ? `, including ${usage.patientNames.length} currently assigned to a real patient (${usage.patientNames.join(", ")})`
          : "";
      return NextResponse.json(
        {
          error: `Still used in ${usage.workoutCount} workout${usage.workoutCount === 1 ? "" : "s"}${patientPart}. Remove it from ${usage.workoutCount === 1 ? "that workout" : "those workouts"} first.`,
        },
        { status: 409 }
      );
    }

    const { error } = await supabaseAdmin.from("blocks").delete().eq("id", id);
    if (error) {
      if (error.code === "23503") {
        return NextResponse.json({ error: "Still in use by a workout. Remove it from there first." }, { status: 409 });
      }
      throw new Error(error.message);
    }
    return NextResponse.json({ id });
  } catch (err) {
    console.error("delete block failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Remove failed: ${detail}` }, { status: 500 });
  }
}
