import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { currentWeekNumber } from "@/lib/programmeWeek";
import { repeatProgrammeWeek } from "@/lib/programmeCards";
import { buildRowingPlan, type RowingInputs, type RowingPlanCard } from "@/lib/rowing/rowingPlan";
import { matchRows, suggest, type Kind, type LogLite, type MatchedRow, type PlanCardLite, type ResultLite } from "@/lib/rowing/rowingSuggest";
import { syncConcept2 } from "@/lib/rowing/concept2";

export type RowingPlanRow = {
  id: string;
  programme_id: string;
  patient_id: string | null;
  inputs: RowingInputs;
  reference_split_seconds: number;
  reference_source: string;
  slack_weeks: number;
  updated_at: string;
};

type ProgrammeRow = { id: string; patient_id: string | null; start_date: string; block_length_weeks: number; title: string };

export type RowingContext = {
  plan: RowingPlanRow;
  programme: ProgrammeRow;
  cards: (PlanCardLite & { workoutId: string; title: string })[];
  rows: MatchedRow[];
  logs: LogLite[];
  currentWeek: number;
};

function toResultLite(r: {
  id: string;
  rowed_on: string;
  distance_m: number;
  time_tenths: number;
  avg_split_seconds: number;
  workout_type: string | null;
  stroke_rate: number | null;
  avg_hr: number | null;
}): ResultLite {
  return {
    id: r.id,
    rowedOn: r.rowed_on,
    distanceM: r.distance_m,
    timeSeconds: r.time_tenths / 10,
    avgSplit: Number(r.avg_split_seconds),
    workoutType: r.workout_type,
    strokeRate: r.stroke_rate,
    avgHr: r.avg_hr,
  };
}

export async function loadRowingContext(programmeId: string): Promise<RowingContext | null> {
  const { data: plan } = await supabaseAdmin
    .from("rowing_plans")
    .select("id, programme_id, patient_id, inputs, reference_split_seconds, reference_source, slack_weeks, updated_at")
    .eq("programme_id", programmeId)
    .maybeSingle<RowingPlanRow>();
  if (!plan) return null;
  const { data: programme } = await supabaseAdmin
    .from("programmes")
    .select("id, patient_id, start_date, block_length_weeks, title")
    .eq("id", programmeId)
    .maybeSingle<ProgrammeRow>();
  if (!programme || !programme.patient_id) return null;

  const { data: pw } = await supabaseAdmin
    .from("programme_workouts")
    .select("workout_id, day_of_week, week_number, workouts(name, plan_session)")
    .eq("programme_id", programmeId)
    .returns<{ workout_id: string; day_of_week: number | null; week_number: number | null; workouts: { name: string; plan_session: RowingPlanCard | null } | null }[]>();
  const cards = (pw ?? [])
    .filter((r) => r.week_number != null && r.day_of_week != null && r.workouts?.plan_session?.rowing)
    .map((r) => ({
      week: r.week_number as number,
      day: r.day_of_week as number,
      meta: r.workouts!.plan_session!.rowing!,
      workoutId: r.workout_id,
      title: r.workouts!.name,
    }));

  const startDay = programme.start_date.slice(0, 10);
  const { data: results } = await supabaseAdmin
    .from("rowing_results")
    .select("id, rowed_on, distance_m, time_tenths, avg_split_seconds, workout_type, stroke_rate, avg_hr")
    .eq("patient_id", programme.patient_id)
    .gte("rowed_on", plan.inputs.testDate < startDay ? plan.inputs.testDate : startDay)
    .order("rowed_on", { ascending: false })
    .limit(200);
  const rows = matchRows(programme.start_date, (results ?? []).map(toResultLite), cards);

  const { data: logRows } = await supabaseAdmin
    .from("programme_card_logs")
    .select("completed_quality, next_morning_answer, pain_score, completed_at")
    .eq("programme_id", programmeId)
    .order("completed_at", { ascending: false })
    .limit(60)
    .returns<{ completed_quality: string | null; next_morning_answer: string | null; pain_score: number | null; completed_at: string }[]>();
  const logs: LogLite[] = (logRows ?? []).map((l) => ({
    completedOn: l.completed_at.slice(0, 10),
    quality: l.completed_quality,
    morning: l.next_morning_answer,
    pain: l.pain_score,
  }));

  return {
    plan: { ...plan, reference_split_seconds: Number(plan.reference_split_seconds) },
    programme,
    cards,
    rows,
    logs,
    currentWeek: currentWeekNumber(programme.start_date, programme.block_length_weeks),
  };
}

/** Pulls new rows (when the client is connected) and files any new suggestions. */
export async function refreshRowing(programmeId: string): Promise<{ added: number; suggestions: number; syncError: string | null; connected: boolean }> {
  const ctx0 = await loadRowingContext(programmeId);
  if (!ctx0) return { added: 0, suggestions: 0, syncError: null, connected: false };
  const sync = await syncConcept2(ctx0.programme.patient_id as string, ctx0.plan.inputs.testDate);
  const ctx = sync.added > 0 ? await loadRowingContext(programmeId) : ctx0;
  if (!ctx) return { added: sync.added, suggestions: 0, syncError: sync.error, connected: sync.connected };
  const filed = await fileSuggestions(ctx);
  return { added: sync.added, suggestions: filed, syncError: sync.error, connected: sync.connected };
}

export async function fileSuggestions(ctx: RowingContext): Promise<number> {
  const { data: existing } = await supabaseAdmin
    .from("rowing_suggestions")
    .select("kind, status, resolved_at, source_result_id")
    .eq("programme_id", ctx.programme.id)
    .returns<{ kind: Kind; status: string; resolved_at: string | null; source_result_id: string | null }[]>();
  const today = new Date().toISOString().slice(0, 10);
  const drafts = suggest({
    today,
    reference: ctx.plan.reference_split_seconds,
    referenceSince: ctx.plan.reference_source === "entry_test" ? ctx.plan.inputs.testDate : ctx.plan.updated_at.slice(0, 10),
    slackWeeks: ctx.plan.slack_weeks,
    rows: ctx.rows,
    logs: ctx.logs,
    pendingKinds: (existing ?? []).filter((e) => e.status === "pending").map((e) => e.kind),
    recentlyAnswered: (existing ?? [])
      .filter((e) => e.status !== "pending" && e.resolved_at)
      .map((e) => ({ kind: e.kind, resolvedOn: (e.resolved_at as string).slice(0, 10) })),
    usedTestResultIds: (existing ?? []).map((e) => e.source_result_id).filter((v): v is string => Boolean(v)),
  });
  if (drafts.length === 0) return 0;
  const { error } = await supabaseAdmin.from("rowing_suggestions").insert(
    drafts.map((d) => ({
      programme_id: ctx.programme.id,
      patient_id: ctx.programme.patient_id,
      kind: d.kind,
      from_split_seconds: d.from,
      to_split_seconds: d.to,
      week_number: ctx.currentWeek,
      reason: d.reason,
      evidence: d.evidence,
      source_result_id: d.sourceResultId,
    }))
  );
  if (error && !error.message.includes("duplicate")) throw new Error(error.message);
  return drafts.length;
}

/**
 * Rebuilds the plan from the same inputs at a new reference split and
 * rewrites the rowing cards from the current week onwards. Only the card
 * content changes; where Dr David Silver PhD has moved a card to another
 * day or week, it stays where he put it.
 */
export async function rewritePaces(programmeId: string, newReference: number, source: "new_test" | "paces_up" | "paces_down"): Promise<number> {
  const ctx = await loadRowingContext(programmeId);
  if (!ctx) throw new Error("This rowing plan could not be found.");
  const rebuilt = buildRowingPlan(ctx.plan.inputs, newReference);
  if (!rebuilt.ok) throw new Error(rebuilt.errors.join(" "));
  const byKey = new Map(rebuilt.cards.map((c) => [c.plan.rowing!.key, c.plan]));

  let changed = 0;
  for (const card of ctx.cards) {
    if (card.week < ctx.currentWeek) continue;
    const next = byKey.get(card.meta.key);
    if (!next) continue;
    const { error } = await supabaseAdmin
      .from("workouts")
      .update({ plan_session: next, updated_at: new Date().toISOString() })
      .eq("id", card.workoutId);
    if (error) throw new Error(error.message);
    changed += 1;
  }
  const { error } = await supabaseAdmin
    .from("rowing_plans")
    .update({ reference_split_seconds: newReference, reference_source: source, updated_at: new Date().toISOString() })
    .eq("id", ctx.plan.id);
  if (error) throw new Error(error.message);
  return changed;
}

export async function answerSuggestion(id: string, action: "approve" | "hold"): Promise<{ message: string }> {
  const { data: s } = await supabaseAdmin
    .from("rowing_suggestions")
    .select("id, programme_id, patient_id, kind, status, to_split_seconds")
    .eq("id", id)
    .maybeSingle<{ id: string; programme_id: string; patient_id: string; kind: Kind; status: string; to_split_seconds: number | null }>();
  if (!s) throw new Error("That suggestion no longer exists.");
  if (s.status !== "pending") throw new Error("That suggestion has already been answered.");

  let message = "Held. Nothing in the plan has changed.";
  if (action === "approve") {
    if (s.kind === "hold_week") {
      const ctx = await loadRowingContext(s.programme_id);
      if (!ctx) throw new Error("This rowing plan could not be found.");
      await repeatProgrammeWeek(s.programme_id, s.patient_id, ctx.currentWeek, "repeat_week");
      await supabaseAdmin
        .from("rowing_plans")
        .update({ slack_weeks: Math.max(0, ctx.plan.slack_weeks - 1) })
        .eq("id", ctx.plan.id);
      message = `Week ${ctx.currentWeek} repeats, and the rest of the plan moves back a week.`;
    } else {
      if (s.to_split_seconds == null) throw new Error("This suggestion has no new pace to apply.");
      const n = await rewritePaces(s.programme_id, Number(s.to_split_seconds), s.kind);
      message = `Paces updated on ${n} rowing session${n === 1 ? "" : "s"} from this week on.`;
    }
  }
  const { error } = await supabaseAdmin
    .from("rowing_suggestions")
    .update({ status: action === "approve" ? "approved" : "held", resolved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { message };
}
