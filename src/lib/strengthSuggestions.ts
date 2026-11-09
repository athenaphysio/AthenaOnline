// Step up, hold or step back, from what a client has logged. Pure rules and
// no database: given the client's logs, what each exercise asked for that
// week, and the decisions Dr David Silver PhD has already made, it returns
// the suggestions still waiting for him. Nothing changes in a programme
// until he approves one (strengthSuggestionsApply.ts).
//
// DRAFT THRESHOLDS FOR DR DAVID SILVER PhD TO CHECK, gathered in SUGGESTION_RULES.

export const SUGGESTION_RULES = {
  /** Pain at or above this on the latest log suggests stepping back. */
  painStepBack: 4,
  /** Pain at or above this on two of the last three logs also suggests stepping back. */
  painRepeated: 3,
  /** Logs this many points easier than planned, twice running, with the reps done, suggest stepping up. */
  easierBy: 2,
  /** Pain must stay at or below this to step up. */
  painCeilingForStepUp: 2,
};

export type StrengthLog = {
  id: string;
  exercise_id: string;
  week_number: number;
  day_of_week: number;
  weight_kg: number | null;
  reps_done: number | null;
  seconds_done: number | null;
  effort: number | null;
  pain: number | null;
  not_sure: boolean;
  note: string | null;
  logged_at: string;
};

export type Planned = { sets: number | null; reps: number | null; hold_seconds: number | null; effort: number | null };

export type SuggestionExercise = {
  exercise_id: string;
  name: string;
  progression: string | null;
  regression: string | null;
};

export type Suggestion = {
  exercise_id: string;
  name: string;
  kind: "step_up" | "step_back";
  log_id: string;
  week: number;
  why: string;
  change: string;
  /** Set when the library links the next exercise up or down by EX number. */
  swap_to: string | null;
};

export function plannedEffortFrom(rationale: string | null): number | null {
  const m = rationale?.match(/Effort (\d+) out of 10/);
  return m ? Number(m[1]) : null;
}

function linked(text: string | null): string | null {
  return text?.match(/EX-\d{3}/)?.[0] ?? null;
}

function doneAsked(log: StrengthLog, plan: Planned | undefined): boolean {
  if (!plan) return false;
  if (plan.hold_seconds != null) return log.seconds_done != null && log.seconds_done >= plan.hold_seconds;
  if (plan.reps != null) return log.reps_done != null && log.reps_done >= plan.reps;
  return true;
}

export function suggestFor(params: {
  logs: StrengthLog[];
  /** What each exercise asked for, keyed `${exercise_id}:${week}`. */
  planned: Map<string, Planned>;
  exercises: Map<string, SuggestionExercise>;
  /** Log ids David has already answered. */
  decided: Set<string>;
  names?: Map<string, string>;
}): Suggestion[] {
  const { logs, planned, exercises, decided } = params;
  const byExercise = new Map<string, StrengthLog[]>();
  for (const l of logs) byExercise.set(l.exercise_id, [...(byExercise.get(l.exercise_id) ?? []), l]);
  const out: Suggestion[] = [];

  for (const [exId, list] of byExercise) {
    const sorted = [...list].sort((a, b) => a.week_number - b.week_number || a.day_of_week - b.day_of_week || a.logged_at.localeCompare(b.logged_at));
    const latest = sorted[sorted.length - 1];
    if (!latest || decided.has(latest.id)) continue;
    const ex = exercises.get(exId);
    const name = ex?.name ?? exId;
    const plan = planned.get(`${exId}:${latest.week_number}`);
    const last3 = sorted.slice(-3);

    // Step back: pain, or a set that was much harder than planned and fell short.
    const painNow = latest.pain != null && latest.pain >= SUGGESTION_RULES.painStepBack;
    const painRepeated = last3.filter((l) => (l.pain ?? 0) >= SUGGESTION_RULES.painRepeated).length >= 2;
    const tooHard = latest.effort != null && plan?.effort != null && latest.effort >= Math.max(9, plan.effort + 2) && !doneAsked(latest, plan);
    if (painNow || painRepeated || tooHard) {
      const swap = linked(ex?.regression ?? null);
      const why = painNow
        ? `Pain ${latest.pain} out of 10 on week ${latest.week_number}.`
        : painRepeated
          ? `Pain of 3 or more on two of the last three times.`
          : `Effort ${latest.effort} out of 10 against ${plan?.effort} planned, and short of the reps.`;
      out.push({
        exercise_id: exId,
        name,
        kind: "step_back",
        log_id: latest.id,
        week: latest.week_number,
        why,
        change: swap
          ? `Swap to ${params.names?.get(swap) ?? swap} from week ${latest.week_number + 1}.`
          : `One set fewer and two reps (or ten seconds) less from week ${latest.week_number + 1}${ex?.regression ? `. Your regression note: ${ex.regression}` : ""}.`,
        swap_to: swap,
      });
      continue;
    }

    // Step up: easier than planned twice running, the reps done, little or no pain.
    const lastTwo = sorted.slice(-2);
    const easy =
      lastTwo.length === 2 &&
      lastTwo.every((l) => {
        const p = planned.get(`${exId}:${l.week_number}`);
        return (
          l.effort != null &&
          p?.effort != null &&
          l.effort <= p.effort - SUGGESTION_RULES.easierBy &&
          doneAsked(l, p) &&
          (l.pain ?? 0) <= SUGGESTION_RULES.painCeilingForStepUp
        );
      });
    if (easy) {
      const swap = linked(ex?.progression ?? null);
      out.push({
        exercise_id: exId,
        name,
        kind: "step_up",
        log_id: latest.id,
        week: latest.week_number,
        why: `Logged at effort ${lastTwo.map((l) => l.effort).join(" then ")} out of 10 against ${plan?.effort ?? "?"} planned, with every rep done.`,
        change: swap
          ? `Swap to ${params.names?.get(swap) ?? swap} from week ${latest.week_number + 1}.`
          : `Two more reps (or ten more seconds) from week ${latest.week_number + 1}, and a note to add a little weight${ex?.progression ? `. Your progression note: ${ex.progression}` : ""}.`,
        swap_to: swap,
      });
    }
  }
  return out.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "step_back" ? -1 : 1));
}
