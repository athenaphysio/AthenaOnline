import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { CardioBlockDetail } from "@/lib/cardioBlock";

const COLUMNS =
  "id, name, modality, modality_other, structure, rationale, category, entry_criteria, stop_rule, " +
  "steady_duration_seconds, steady_distance_m, steady_intensity_percent, steady_hr_zone, steady_pace, " +
  "steady_power_watts, steady_cadence, steady_incline_resistance, " +
  "interval_reps, interval_work_seconds, interval_intensities_percent, interval_rest_mode, " +
  "interval_rest_seconds, interval_rest_percent_recovered, interval_rest_type, interval_rest_type_other";

// Fetches one cardio block's full detail -- used when a clinician adds an
// existing one from the library into a Workout, so it can expand inline
// (via CardioBlockEditor) instead of staying an opaque reference. Same role
// GET /api/clinic/blocks/[id] plays for a Block.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from("cardio_blocks")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle<CardioBlockDetail>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Cardio block not found." }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as Omit<CardioBlockDetail, "id">;

  if (!body.name || !body.modality || !body.structure) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  try {
    const { error } = await supabaseAdmin
      .from("cardio_blocks")
      .update({
        name: body.name,
        modality: body.modality,
        modality_other: body.modality_other,
        structure: body.structure,
        rationale: body.rationale,
        category: body.category,
        entry_criteria: body.entry_criteria,
        stop_rule: body.stop_rule,
        steady_duration_seconds: body.steady_duration_seconds,
        steady_distance_m: body.steady_distance_m,
        steady_intensity_percent: body.steady_intensity_percent,
        steady_hr_zone: body.steady_hr_zone,
        steady_pace: body.steady_pace,
        steady_power_watts: body.steady_power_watts,
        steady_cadence: body.steady_cadence,
        steady_incline_resistance: body.steady_incline_resistance,
        interval_reps: body.interval_reps,
        interval_work_seconds: body.interval_work_seconds,
        interval_intensities_percent: body.interval_intensities_percent,
        interval_rest_mode: body.interval_rest_mode,
        interval_rest_seconds: body.interval_rest_seconds,
        interval_rest_percent_recovered: body.interval_rest_percent_recovered,
        interval_rest_type: body.interval_rest_type,
        interval_rest_type_other: body.interval_rest_type_other,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ id });
  } catch (err) {
    console.error("update cardio block failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Update failed: ${detail}` }, { status: 500 });
  }
}
