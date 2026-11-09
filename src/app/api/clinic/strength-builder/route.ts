import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";
import type { OtherCard, PlanSlot } from "@/lib/strengthBuilder";
import { applyOverrides, readStrengthProfile, type StrengthOverrides } from "@/lib/strengthProfile";
import { buildStrengthSessions, type EngineExercise, type PrepBlock } from "@/lib/strengthEngine";
import { saveBuiltSessions } from "@/lib/strengthSave";

type Body = {
  patient_id?: string;
  programme_id?: string;
  slots?: PlanSlot[];
  others?: (OtherCard & { total?: string })[];
  weeks?: number;
  /** David pressed "Build strength" himself, so build even when the client's switch is off. */
  force?: boolean;
};

type ExerciseRow = {
  exercise_id: string;
  name_clinical: string | null;
  name_patient_facing: string | null;
  movement_pattern: string | null;
  equipment: string | null;
  difficulty: string | null;
  rehab_stage: string | null;
  body_site: string | null;
  condition_use_case: string | null;
  contraindication_flags: string | null;
  progression: string | null;
  cues_notes: string | null;
  vimeo_url: string | null;
};

type PrepRow = {
  id: string;
  name: string;
  block_items: {
    item_order: number;
    block_item_weeks: { week_number: number; exercise_id: string; sets: number | null; reps: number | null; hold_seconds: number | null; prescription_mode: string | null; rationale: string | null }[];
  }[];
};

// Builds a client's strength for a plan that has just opened in the
// builder. Reads their strength profile (intake form and consultation notes,
// with David's corrections on top), builds each session exercise by
// exercise with strengthEngine.ts, saves the sessions as this programme's
// own copies, and returns which session goes on which day.
export async function POST(request: NextRequest) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Body;
  const { patient_id, programme_id, force } = body;
  const slots = Array.isArray(body.slots) ? body.slots : [];
  const others = Array.isArray(body.others) ? body.others : [];
  const weeks = Number.isInteger(body.weeks) && (body.weeks as number) > 0 ? Math.min(body.weeks as number, 24) : 1;
  if (!patient_id) return NextResponse.json({ error: "Choose a client first." }, { status: 400 });
  if (!programme_id) return NextResponse.json({ error: "The programme is not ready yet. Try again in a moment." }, { status: 400 });

  const { data: patient, error: patientError } = await supabaseAdmin
    .from("patients")
    .select("first_name, auto_strength, strength_profile")
    .eq("id", patient_id)
    .maybeSingle<{ first_name: string; auto_strength: boolean | null; strength_profile: StrengthOverrides | null }>();
  if (patientError) return NextResponse.json({ error: patientError.message }, { status: 500 });
  if (!patient) return NextResponse.json({ error: "That client no longer exists." }, { status: 404 });

  if (patient.auto_strength === false && !force) {
    return NextResponse.json({ built: false, reason: "off", firstName: patient.first_name });
  }

  const { data: entries, error: entriesError } = await supabaseAdmin
    .from("client_context_entries")
    .select("summary_text, notes_text")
    .eq("patient_id", patient_id)
    .returns<{ summary_text: string | null; notes_text: string | null }[]>();
  if (entriesError) return NextResponse.json({ error: entriesError.message }, { status: 500 });
  const texts = (entries ?? []).flatMap((e) => [e.summary_text ?? "", e.notes_text ?? ""]).filter(Boolean);
  const profile = applyOverrides(readStrengthProfile(texts), patient.strength_profile);

  // A plan from Claude with strength slots in it counts as strength having
  // come up, even if the notes themselves never say so.
  if (!profile.discussed && slots.length === 0 && !force) {
    return NextResponse.json({ built: false, reason: "not_discussed", firstName: patient.first_name });
  }

  const { data: exercises, error: exError } = await supabaseAdmin
    .from("exercises")
    .select(
      "exercise_id, name_clinical, name_patient_facing, movement_pattern, equipment, difficulty, rehab_stage, body_site, condition_use_case, contraindication_flags, progression, cues_notes, vimeo_url"
    )
    .eq("active", true)
    .returns<ExerciseRow[]>();
  if (exError) return NextResponse.json({ error: exError.message }, { status: 500 });
  const library: EngineExercise[] = (exercises ?? []).map((e) => ({
    exercise_id: e.exercise_id,
    name: e.name_clinical ?? e.name_patient_facing ?? e.exercise_id,
    movement_pattern: e.movement_pattern,
    equipment: e.equipment,
    difficulty: e.difficulty,
    rehab_stage: e.rehab_stage,
    body_site: e.body_site,
    condition_use_case: e.condition_use_case,
    contraindication_flags: e.contraindication_flags,
    progression: e.progression,
    cues_notes: e.cues_notes,
    has_video: Boolean(e.vimeo_url),
  }));

  // Warm ups come from David's own library prep blocks: the gym ones for a
  // gym, the minimal kit ones otherwise.
  const { data: prepRows, error: prepError } = await supabaseAdmin
    .from("blocks")
    .select("id, name, block_items(item_order, block_item_weeks(week_number, exercise_id, sets, reps, hold_seconds, prescription_mode, rationale))")
    .is("programme_id", null)
    .in("type", ["activation", "warm_up"])
    .returns<PrepRow[]>();
  if (prepError) return NextResponse.json({ error: prepError.message }, { status: 500 });
  const gym = profile.kit.includes("gym");
  const prepFor = (region: "upper" | "lower"): PrepBlock | null => {
    const regionRe = region === "upper" ? /upper/i : /lower/i;
    const rows = (prepRows ?? []).filter((b) => regionRe.test(b.name));
    const best =
      rows.find((b) => (gym ? /gym/i : /keep strong|home|hotel/i).test(b.name) && /prep/i.test(b.name)) ??
      rows.find((b) => /prep/i.test(b.name)) ??
      null;
    if (!best) return null;
    return {
      name: best.name,
      items: [...best.block_items]
        .sort((a, b) => a.item_order - b.item_order)
        .map((i) => i.block_item_weeks.find((w) => w.week_number === 1))
        .filter((w): w is NonNullable<typeof w> => Boolean(w))
        .map((w) => ({
          exercise_id: w.exercise_id,
          sets: w.sets,
          reps: w.reps,
          hold_seconds: w.hold_seconds,
          prescription_mode: w.prescription_mode ?? "reps_and_sets",
          rationale: w.rationale,
        })),
    };
  };

  const result = buildStrengthSessions({
    profile,
    library,
    prep: { upper: prepFor("upper"), lower: prepFor("lower") },
    slots,
    others,
    weeks,
  });
  if (result.sessions.length === 0) {
    return NextResponse.json({ built: false, reason: "nothing_fits", firstName: patient.first_name, notes: result.notes });
  }

  let saved;
  try {
    saved = await saveBuiltSessions(programme_id, result.sessions, weeks);
  } catch (err) {
    console.error("strength save failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "The strength sessions could not be saved." }, { status: 500 });
  }
  const byKey = new Map(saved.map((s) => [s.key, s]));

  return NextResponse.json({
    built: true,
    reason: "built",
    firstName: patient.first_name,
    profile,
    sessions: result.sessions.map((s) => ({ key: s.key, name: s.name, region: s.region, minutes: s.minutes, targetMinutes: s.targetMinutes, reasons: s.reasons })),
    notes: result.notes,
    placements: result.placements
      .map((p) => {
        const w = byKey.get(p.sessionKey);
        return w ? { slotKey: p.slotKey, week: p.week, day: p.day, workout: { id: w.id, name: w.name, high_load: w.high_load, kind: "standard" } } : null;
      })
      .filter(Boolean),
  });
}
