// Performance metrics: turns a client's goals, tests and weekly running
// into the headline numbers and graphs on the Performance metrics card.
// No server code, so the card can be drawn anywhere.
//
// THRESHOLDS FOR DR DAVID SILVER PhD TO CHECK, gathered in ZONES. They are
// the ones in the brief of 6 November 2026.

import { formatSeconds, performanceType, riegel, type PerformanceType } from "@/lib/performanceTypes";

export const ZONES = {
  // Marathon: minutes either side of the line, at the start and on race day.
  marathonStartMinutes: 7,
  marathonEndMinutes: 4,
  // Other running goals are scaled from those by goal time, against a
  // four hour marathon.
  marathonReferenceSeconds: 4 * 3600,
  // Erg power goals, and rowing time goals: share either side of the line.
  ergShare: 0.03,
  // Weekly running km: the safe range around the planned km.
  weeklyLow: 0.85,
  weeklyHigh: 1.1,
};

export type Goal = {
  id: string;
  goal_type: PerformanceType;
  target_text: string;
  target_seconds: number | null;
  target_watts: number | null;
  distance_m: number | null;
  goal_date: string | null;
  event_name: string | null;
};

export type Test = {
  id: string;
  tested_on: string;
  test_type: PerformanceType;
  result_text: string;
  result_seconds: number | null;
  result_watts: number | null;
  distance_m: number | null;
  avg_split_seconds: number | null;
  stroke_rate: number | null;
  drag_factor: number | null;
  is_race: boolean;
  notes: string | null;
  added_by: "client" | "clinician";
  rowing_result_id?: string | null;
};

export type Status = "on_track" | "ahead" | "behind" | "reached" | "none";

export type ChartPoint = { date: string; value: number; label: string; status: Status };

export type GoalChart = {
  goalId: string;
  question: string; // the plain question the graph answers
  title: string; // the goal, in words
  higherIsBetter: boolean;
  unit: "time" | "watts";
  points: ChartPoint[];
  // The dashed target line, from the first test to the goal.
  line: { from: { date: string; value: number }; to: { date: string; value: number } } | null;
  // Half the zone's height at each end of the line.
  zone: { startHalf: number; endHalf: number } | null;
  goalValue: number;
  // True when the dots are predictions for the goal race rather than the
  // goal measure itself, so beating the goal reads as ahead, not reached.
  predicted: boolean;
  headline: { text: string; status: Status };
  fewTests: boolean;
};

export type WeekLoad = { weekStart: string; loggedKm: number; plannedKm: number | null; above: boolean };

const DAY = 86400000;

function days(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / DAY);
}

export function formatValue(unit: "time" | "watts", v: number): string {
  return unit === "watts" ? `${Math.round(v)} W` : formatSeconds(v);
}

function lineAt(chart: Pick<GoalChart, "line" | "zone">, date: string): { value: number; half: number } | null {
  if (!chart.line) return null;
  const total = Math.max(1, days(chart.line.from.date, chart.line.to.date));
  const t = Math.min(1, Math.max(0, days(chart.line.from.date, date) / total));
  return {
    value: chart.line.from.value + (chart.line.to.value - chart.line.from.value) * t,
    half: chart.zone ? chart.zone.startHalf + (chart.zone.endHalf - chart.zone.startHalf) * t : 0,
  };
}

function statusFor(chart: Pick<GoalChart, "line" | "zone" | "higherIsBetter" | "goalValue" | "predicted">, date: string, value: number): Status {
  const better = (a: number, b: number) => (chart.higherIsBetter ? a > b : a < b);
  if (better(value, chart.goalValue) || value === chart.goalValue) return chart.predicted ? "ahead" : "reached";
  const at = lineAt(chart, date);
  if (!at) return "none";
  if (Math.abs(value - at.value) <= at.half) return "on_track";
  return better(value, at.value) ? "ahead" : "behind";
}

function isRunTest(t: Test): boolean {
  return performanceType(t.test_type)?.family === "run" && t.result_seconds != null && (t.distance_m ?? 0) > 0;
}

/** One graph per goal that has something to draw. */
export function chartsFor(goals: Goal[], tests: Test[]): GoalChart[] {
  const charts: GoalChart[] = [];
  const byDate = [...tests].sort((a, b) => (a.tested_on < b.tested_on ? -1 : a.tested_on > b.tested_on ? 1 : 0));

  for (const g of goals) {
    const type = performanceType(g.goal_type);
    if (!type) continue;
    const eventWords = g.event_name ? ` at ${g.event_name}` : "";

    // 1. Running: every run test or race predicts the goal race (Riegel).
    if (type.family === "run" && g.target_seconds && g.distance_m) {
      const goalDistance = g.distance_m;
      const points = byDate.filter(isRunTest).map((t) => {
        const predicted = riegel(Number(t.result_seconds), Number(t.distance_m), goalDistance);
        const what = performanceType(t.test_type)?.label ?? "Run";
        return { date: t.tested_on, value: predicted, label: `${what} ${t.result_text}${t.is_race ? " (race)" : ""}`, status: "none" as Status };
      });
      const scale = g.goal_type === "marathon" ? 1 : Number(g.target_seconds) / ZONES.marathonReferenceSeconds;
      const chart: GoalChart = {
        goalId: g.id,
        question: "Am I getting fitter?",
        title: `${type.label} in ${g.target_text}${eventWords}`,
        higherIsBetter: false,
        unit: "time",
        points,
        line: points.length && g.goal_date && g.goal_date > points[0].date ? { from: { date: points[0].date, value: points[0].value }, to: { date: g.goal_date, value: Number(g.target_seconds) } } : null,
        zone: { startHalf: ZONES.marathonStartMinutes * 60 * scale, endHalf: ZONES.marathonEndMinutes * 60 * scale },
        goalValue: Number(g.target_seconds),
        predicted: true,
        headline: { text: "", status: "none" },
        fewTests: points.length < 2,
      };
      finish(chart, (latest) => `Predicted ${type.label.toLowerCase()} ${formatSeconds(latest)}, goal ${g.target_text}`);
      charts.push(chart);
      continue;
    }

    // 3. Erg power: 20 minute tests as average watts.
    if (g.goal_type === "20min_erg" && g.target_watts) {
      const points = byDate
        .filter((t) => t.test_type === "20min_erg" && t.result_watts)
        .map((t) => ({ date: t.tested_on, value: Number(t.result_watts), label: `20 min erg ${t.result_watts} W`, status: "none" as Status }));
      const chart: GoalChart = {
        goalId: g.id,
        question: "Is my erg power building?",
        title: `20 minute erg at ${g.target_text}${eventWords}`,
        higherIsBetter: true,
        unit: "watts",
        points,
        line: points.length && g.goal_date && g.goal_date > points[0].date ? { from: { date: points[0].date, value: points[0].value }, to: { date: g.goal_date, value: g.target_watts } } : null,
        zone: null,
        goalValue: g.target_watts,
        predicted: false,
        headline: { text: "", status: "none" },
        fewTests: points.length < 2,
      };
      if (chart.line) chart.zone = { startHalf: chart.line.from.value * ZONES.ergShare, endHalf: g.target_watts * ZONES.ergShare };
      finish(chart, (latest) => `Latest 20 minute erg ${Math.round(latest)} W, goal ${g.target_text}`);
      charts.push(chart);
      continue;
    }

    // Rowing time goals (2K, 10K, a long row): tests of the same kind and
    // distance only. No prediction across distances, which is unreliable
    // for very long rows.
    if (type.family === "row" && g.target_seconds) {
      const points = byDate
        .filter((t) => t.test_type === g.goal_type && t.result_seconds && (g.goal_type !== "long_row" || t.distance_m === g.distance_m))
        .map((t) => ({ date: t.tested_on, value: Number(t.result_seconds), label: `${type.label} ${t.result_text}`, status: "none" as Status }));
      const chart: GoalChart = {
        goalId: g.id,
        question: "Is my rowing getting quicker?",
        title: `${g.goal_type === "long_row" && g.distance_m ? `${(g.distance_m / 1000).toFixed(g.distance_m % 1000 ? 1 : 0)} km row` : type.label} in ${g.target_text}${eventWords}`,
        higherIsBetter: false,
        unit: "time",
        points,
        line: points.length && g.goal_date && g.goal_date > points[0].date ? { from: { date: points[0].date, value: points[0].value }, to: { date: g.goal_date, value: Number(g.target_seconds) } } : null,
        zone: null,
        goalValue: Number(g.target_seconds),
        predicted: false,
        headline: { text: "", status: "none" },
        fewTests: points.length < 2,
      };
      if (chart.line) chart.zone = { startHalf: chart.line.from.value * ZONES.ergShare, endHalf: Number(g.target_seconds) * ZONES.ergShare };
      finish(chart, (latest) => `Best so far ${formatSeconds(latest)}, goal ${g.target_text}`);
      charts.push(chart);
    }
  }
  return charts;
}

function finish(chart: GoalChart, words: (latest: number) => string) {
  chart.points = chart.points.map((p) => ({ ...p, status: statusFor(chart, p.date, p.value) }));
  const latest = chart.points[chart.points.length - 1];
  if (!latest) {
    chart.headline = { text: `No test yet for ${chart.title.charAt(0).toLowerCase()}${chart.title.slice(1)}`, status: "none" };
    return;
  }
  chart.headline = { text: words(latest.value), status: latest.status };
}

/** Kilometres in a plan session's total or target, such as "8 km", "5 miles" or "6-8km". */
export function kmFromText(text: string | null | undefined): number | null {
  if (!text) return null;
  const t = text.toLowerCase();
  const km = t.match(/(\d+(?:\.\d+)?)(?:\s*(?:-|to)\s*(\d+(?:\.\d+)?))?\s*(km|kilomet)/);
  if (km) return km[2] ? (Number(km[1]) + Number(km[2])) / 2 : Number(km[1]);
  const mi = t.match(/(\d+(?:\.\d+)?)(?:\s*(?:-|to)\s*(\d+(?:\.\d+)?))?\s*(mi\b|mile)/);
  if (mi) return (mi[2] ? (Number(mi[1]) + Number(mi[2])) / 2 : Number(mi[1])) * 1.609;
  return null;
}

/** Marks the weeks whose logged km sits above the safe range. */
export function markLoad(weeks: { weekStart: string; loggedKm: number; plannedKm: number | null }[]): WeekLoad[] {
  return weeks.map((w) => ({ ...w, above: w.plannedKm != null && w.plannedKm > 0 && w.loggedKm > w.plannedKm * ZONES.weeklyHigh }));
}

export const STATUS_WORDS: Record<"clinician" | "client", Record<Status, string>> = {
  clinician: { on_track: "On track", ahead: "Ahead", behind: "Behind", reached: "Goal reached", none: "" },
  // Clients never see "behind": a result below the path is information
  // and an invitation to talk, not a verdict.
  client: { on_track: "On track", ahead: "Ahead of the path", behind: "Let's look at this together", reached: "Goal reached", none: "" },
};
