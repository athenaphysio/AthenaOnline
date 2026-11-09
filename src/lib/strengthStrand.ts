// The strength line in a client's progress view, beside fitness, practice
// and feel. Pure: it reads the client's own strength logs and compares each
// loaded lift's estimated best single rep now against the same lift when
// they first logged it, always against their own earlier numbers and never
// against anyone else's. The logs are the strength tests: every logged set
// with a weight and reps is a reading.
//
// DRAFT THRESHOLDS FOR DR DAVID SILVER PhD TO CHECK, gathered in STRAND_RULES.

import type { Strand } from "@/lib/rowing/onTarget";
import type { StrengthLog } from "@/lib/strengthSuggestions";

export const STRAND_RULES = {
  /** A change this size either way, as a share of the first reading, counts as real. */
  meaningful: 0.025,
  /** Pain at or above this on any recent log makes it worth a look whatever the numbers. */
  painFlag: 4,
  /** Only sets of this many reps or fewer are used, since the estimate drifts with high reps. */
  maxReps: 12,
};

/** Epley's estimate of a single best rep from a set. */
export function estimatedBest(weightKg: number, reps: number): number {
  return reps <= 1 ? weightKg : weightKg * (1 + reps / 30);
}

export type LiftTrend = { exercise_id: string; name: string; firstWeek: number; first: number; latestWeek: number; latest: number; change: number };

export function liftTrends(logs: StrengthLog[], names: Map<string, string>): LiftTrend[] {
  const usable = logs.filter((l) => l.weight_kg != null && l.weight_kg > 0 && l.reps_done != null && l.reps_done > 0 && l.reps_done <= STRAND_RULES.maxReps);
  const byExercise = new Map<string, StrengthLog[]>();
  for (const l of usable) byExercise.set(l.exercise_id, [...(byExercise.get(l.exercise_id) ?? []), l]);
  const out: LiftTrend[] = [];
  for (const [id, list] of byExercise) {
    const sorted = [...list].sort((a, b) => a.week_number - b.week_number || a.logged_at.localeCompare(b.logged_at));
    const first = sorted[0];
    const latest = sorted[sorted.length - 1];
    if (first === latest || latest.week_number === first.week_number) continue;
    const a = estimatedBest(Number(first.weight_kg), Number(first.reps_done));
    const b = estimatedBest(Number(latest.weight_kg), Number(latest.reps_done));
    out.push({ exercise_id: id, name: names.get(id) ?? id, firstWeek: first.week_number, first: a, latestWeek: latest.week_number, latest: b, change: (b - a) / a });
  }
  return out.sort((x, y) => y.latest - x.latest);
}

export function strengthStrand(logs: StrengthLog[], names: Map<string, string>): Strand {
  if (logs.length === 0) return { label: "Strength", status: "Nothing logged yet", tone: "none", detail: "Strength logs with a weight and reps will show here." };
  const recentPain = [...logs].sort((a, b) => b.logged_at.localeCompare(a.logged_at)).slice(0, 6).find((l) => (l.pain ?? 0) >= STRAND_RULES.painFlag);
  const trends = liftTrends(logs, names);
  const kg = (v: number) => `${Math.round(v * 2) / 2} kg`;
  const lines = trends
    .slice(0, 3)
    .map((t) => `${t.name}: estimated best ${kg(t.first)} in week ${t.firstWeek}, ${kg(t.latest)} in week ${t.latestWeek} (${t.change >= 0 ? "+" : ""}${Math.round(t.change * 100)}%).`);
  if (recentPain) {
    return {
      label: "Strength",
      status: "Worth a conversation",
      tone: "look",
      detail: [`Pain ${recentPain.pain} out of 10 logged on ${names.get(recentPain.exercise_id) ?? recentPain.exercise_id} in week ${recentPain.week_number}.`, ...lines].join(" "),
    };
  }
  if (trends.length === 0) {
    return { label: "Strength", status: "Too early to tell", tone: "none", detail: "Each lift needs a weight and reps logged in two different weeks before a trend shows." };
  }
  const changes = trends.map((t) => t.change).sort((a, b) => a - b);
  const middle = changes[Math.floor(changes.length / 2)];
  if (middle >= STRAND_RULES.meaningful) return { label: "Strength", status: "Getting stronger", tone: "good", detail: lines.join(" ") };
  if (middle > -STRAND_RULES.meaningful) return { label: "Strength", status: "Holding steady", tone: "middle", detail: lines.join(" ") };
  return { label: "Strength", status: "Below the first readings", tone: "look", detail: lines.join(" ") };
}
