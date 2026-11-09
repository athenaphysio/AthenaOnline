import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";
import { strengthStrand } from "@/lib/strengthStrand";
import { plannedEffortFrom, suggestFor, type Planned, type StrengthLog, type SuggestionExercise } from "@/lib/strengthSuggestions";

type WeekRow = { id: string; week_number: number; exercise_id: string; sets: number | null; reps: number | null; hold_seconds: number | null; rationale: string | null };

async function programmeRows(programmeId: string): Promise<WeekRow[]> {
  const { data: blocks, error } = await supabaseAdmin
    .from("blocks")
    .select("id, block_items(block_item_weeks(id, week_number, exercise_id, sets, reps, hold_seconds, rationale))")
    .eq("programme_id", programmeId)
    .returns<{ id: string; block_items: { block_item_weeks: WeekRow[] }[] }[]>();
  if (error) throw new Error(error.message);
  return (blocks ?? []).flatMap((b) => b.block_items.flatMap((i) => i.block_item_weeks));
}

async function load(programmeId: string) {
  const [{ data: logs, error: lErr }, rows, { data: decisions, error: dErr }] = await Promise.all([
    supabaseAdmin
      .from("strength_logs")
      .select("id, exercise_id, week_number, day_of_week, weight_kg, reps_done, seconds_done, effort, pain, not_sure, note, logged_at")
      .eq("programme_id", programmeId)
      .order("logged_at", { ascending: false })
      .returns<StrengthLog[]>(),
    programmeRows(programmeId),
    supabaseAdmin.from("strength_decisions").select("based_on_log_id").eq("programme_id", programmeId).returns<{ based_on_log_id: string | null }[]>(),
  ]);
  if (lErr) throw new Error(lErr.message);
  if (dErr) throw new Error(dErr.message);

  const ids = Array.from(new Set([...(logs ?? []).map((l) => l.exercise_id), ...rows.map((r) => r.exercise_id)]));
  const { data: exRows, error: eErr } = ids.length
    ? await supabaseAdmin
        .from("exercises")
        .select("exercise_id, name_clinical, name_patient_facing, progression, regression")
        .in("exercise_id", ids)
        .returns<{ exercise_id: string; name_clinical: string | null; name_patient_facing: string | null; progression: string | null; regression: string | null }[]>()
    : { data: [], error: null };
  if (eErr) throw new Error(eErr.message);
  const linkedIds = (exRows ?? []).flatMap((e) => [e.progression, e.regression].map((t) => t?.match(/EX-\d{3}/)?.[0]).filter((x): x is string => Boolean(x)));
  const { data: linkedRows } = linkedIds.length
    ? await supabaseAdmin.from("exercises").select("exercise_id, name_clinical").in("exercise_id", linkedIds).returns<{ exercise_id: string; name_clinical: string | null }[]>()
    : { data: [] };

  const exercises = new Map<string, SuggestionExercise>(
    (exRows ?? []).map((e) => [
      e.exercise_id,
      { exercise_id: e.exercise_id, name: e.name_patient_facing || e.name_clinical || e.exercise_id, progression: e.progression, regression: e.regression },
    ])
  );
  const names = new Map<string, string>([
    ...(linkedRows ?? []).map((e) => [e.exercise_id, e.name_clinical ?? e.exercise_id] as [string, string]),
    ...Array.from(exercises.values()).map((e) => [e.exercise_id, e.name] as [string, string]),
  ]);
  const planned = new Map<string, Planned>();
  for (const r of rows) {
    const key = `${r.exercise_id}:${r.week_number}`;
    if (!planned.has(key)) planned.set(key, { sets: r.sets, reps: r.reps, hold_seconds: r.hold_seconds, effort: plannedEffortFrom(r.rationale) });
  }
  const decided = new Set((decisions ?? []).map((d) => d.based_on_log_id).filter((x): x is string => Boolean(x)));
  const suggestions = suggestFor({ logs: logs ?? [], planned, exercises, decided, names });
  const recent = (logs ?? []).slice(0, 20).map((l) => ({ ...l, name: names.get(l.exercise_id) ?? l.exercise_id }));
  const strand = strengthStrand(logs ?? [], names);
  return { suggestions, recent, strand };
}

// The step up, hold or step back suggestions waiting for Dr David Silver PhD,
// and the client's recent strength logs.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    return NextResponse.json(await load(id));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not read the strength logs." }, { status: 500 });
  }
}

// Approves or dismisses one suggestion. Approving changes this programme's
// own copy of the exercise from the following week onwards; nothing in the
// library changes.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: programmeId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    log_id?: string;
    exercise_id?: string;
    kind?: "step_up" | "step_back";
    week?: number;
    swap_to?: string | null;
    decision?: "approved" | "dismissed";
  };
  const { log_id, exercise_id, kind, week, swap_to, decision } = body;
  if (!log_id || !exercise_id || (kind !== "step_up" && kind !== "step_back") || !Number.isInteger(week) || (decision !== "approved" && decision !== "dismissed")) {
    return NextResponse.json({ error: "Missing details for that suggestion." }, { status: 400 });
  }

  let detail = "";
  if (decision === "approved") {
    const rows = (await programmeRows(programmeId)).filter((r) => r.exercise_id === exercise_id && r.week_number > (week as number));
    if (rows.length === 0) {
      return NextResponse.json({ error: "There are no later weeks of that exercise left in this programme to change." }, { status: 400 });
    }
    for (const r of rows) {
      let update: Partial<WeekRow>;
      if (swap_to) {
        update = { exercise_id: swap_to };
      } else if (kind === "step_up") {
        update =
          r.hold_seconds != null
            ? { hold_seconds: r.hold_seconds + 10 }
            : {
                reps: r.reps != null ? r.reps + 2 : r.reps,
                rationale: r.rationale && !/add a little weight/i.test(r.rationale) ? `${r.rationale} If every rep feels easy, add a little weight.` : r.rationale,
              };
      } else {
        update =
          r.hold_seconds != null
            ? { sets: r.sets != null ? Math.max(2, r.sets - 1) : r.sets, hold_seconds: Math.max(10, r.hold_seconds - 10) }
            : { sets: r.sets != null ? Math.max(2, r.sets - 1) : r.sets, reps: r.reps != null ? Math.max(3, r.reps - 2) : r.reps };
      }
      const { error } = await supabaseAdmin.from("block_item_weeks").update(update).eq("id", r.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    detail = `${rows.length} later week${rows.length === 1 ? "" : "s"} changed${swap_to ? `, swapped to ${swap_to}` : ""}.`;
  }

  const { error } = await supabaseAdmin
    .from("strength_decisions")
    .insert({ programme_id: programmeId, exercise_id, based_on_log_id: log_id, kind, decision, detail: detail || null });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    return NextResponse.json({ ...(await load(programmeId)), detail });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Saved, but could not read it back." }, { status: 500 });
  }
}
