import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { chartsFor, kmFromText, markLoad, type Goal, type GoalChart, type Test, type WeekLoad } from "@/lib/performanceMetrics";
import type { AthenaPlanV1 } from "@/lib/athenaPlan";
import { formatSeconds, type PerformanceType } from "@/lib/performanceTypes";

export type PerformanceData = {
  goals: Goal[];
  tests: Test[];
  charts: GoalChart[];
  weeks: WeekLoad[];
  // The most recent week above its planned range, for the flag on David's view.
  aboveRange: WeekLoad | null;
  // Recent synced or logged sessions that look like a test, not yet copied
  // into Performance metrics, offered as a one tap copy.
  candidates: TestCandidate[];
};

export type TestCandidate = { rowingResultId: string; date: string; testType: PerformanceType; resultText: string; words: string };

/**
 * Whether a stored session looks like one of the standard tests: a 20
 * minute piece, a 2K or 10K on the erg, a run logged as a test, or a
 * session on a recognised race distance logged as a test.
 */
export function asTestCandidate(r: {
  id: string;
  sport: string;
  rowed_on: string;
  distance_m: number;
  time_tenths: number;
  workout_type: string | null;
  avg_watts: number | null;
}): TestCandidate | null {
  const seconds = r.time_tenths / 10;
  const wt = (r.workout_type ?? "").toLowerCase();
  const manualTest = wt === "manualtest";
  if (r.sport === "row") {
    const watts = r.avg_watts ?? Math.round(2.8 / Math.pow(seconds / r.distance_m, 3));
    const steady = !wt || ["justrow", "fixedtimesplits", "fixedtimeinterval", "fixeddistancesplits", "manualtest", "unknown"].includes(wt);
    if (steady && Math.abs(seconds - 1200) <= 15) {
      return { rowingResultId: r.id, date: r.rowed_on, testType: "20min_erg", resultText: `${watts} W`, words: `20 minute row, ${r.distance_m.toLocaleString("en-GB")} m, ${watts} W` };
    }
    if (steady && Math.abs(r.distance_m - 2000) <= 2 && (manualTest || wt.includes("distance"))) {
      return { rowingResultId: r.id, date: r.rowed_on, testType: "2k_erg", resultText: formatSeconds(seconds, true), words: `2K row in ${formatSeconds(seconds, true)}` };
    }
    if (steady && Math.abs(r.distance_m - 10000) <= 5 && (manualTest || wt.includes("distance"))) {
      return { rowingResultId: r.id, date: r.rowed_on, testType: "10k_row", resultText: formatSeconds(seconds, true), words: `10K row in ${formatSeconds(seconds, true)}` };
    }
    return null;
  }
  if (r.sport === "run" && manualTest) {
    const near = (d: number) => Math.abs(r.distance_m - d) <= d * 0.02;
    const type: PerformanceType | null = near(5000) ? "5k_run" : near(10000) ? "10k_run" : near(21097) ? "half_marathon" : near(42195) ? "marathon" : null;
    if (!type) return null;
    return { rowingResultId: r.id, date: r.rowed_on, testType: type, resultText: formatSeconds(seconds), words: `${r.distance_m.toLocaleString("en-GB")} m run in ${formatSeconds(seconds)}` };
  }
  return null;
}

const DAY = 86400000;

function monday(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - back * DAY).toISOString().slice(0, 10);
}

function addDays(iso: string, n: number): string {
  return new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * DAY).toISOString().slice(0, 10);
}

/** Everything the Performance metrics card shows, for one client. */
export async function loadPerformance(patientId: string): Promise<PerformanceData> {
  const today = new Date().toISOString().slice(0, 10);
  const thisWeek = monday(today);
  const firstWeek = addDays(thisWeek, -11 * 7);

  const [{ data: goals }, { data: tests }, { data: runs }, { data: files }, { data: plans }, { data: recent }] = await Promise.all([
    supabaseAdmin
      .from("client_goals")
      .select("id, goal_type, target_text, target_seconds, target_watts, distance_m, goal_date, event_name")
      .eq("patient_id", patientId)
      .order("sort_order")
      .order("created_at")
      .returns<Goal[]>(),
    supabaseAdmin
      .from("performance_tests")
      .select("id, tested_on, test_type, result_text, result_seconds, result_watts, distance_m, avg_split_seconds, stroke_rate, drag_factor, is_race, notes, added_by, rowing_result_id")
      .eq("patient_id", patientId)
      .order("tested_on", { ascending: false })
      .order("created_at", { ascending: false })
      .returns<Test[]>(),
    supabaseAdmin
      .from("rowing_results")
      .select("rowed_on, distance_m")
      .eq("patient_id", patientId)
      .eq("sport", "run")
      .gte("rowed_on", firstWeek)
      .returns<{ rowed_on: string; distance_m: number }[]>(),
    supabaseAdmin
      .from("uploaded_workouts")
      .select("started_at, distance_m")
      .eq("patient_id", patientId)
      .eq("sport", "run")
      .is("rowing_result_id", null)
      .gte("started_at", `${firstWeek}T00:00:00Z`)
      .returns<{ started_at: string; distance_m: number | null }[]>(),
    supabaseAdmin
      .from("imported_plans")
      .select("id, raw_json, effective_start_date")
      .eq("patient_id", patientId)
      .in("status", ["assigned", "replaced"])
      .returns<{ id: string; raw_json: AthenaPlanV1; effective_start_date: string }[]>(),
    supabaseAdmin
      .from("rowing_results")
      .select("id, sport, rowed_on, distance_m, time_tenths, workout_type, avg_watts")
      .eq("patient_id", patientId)
      .gte("rowed_on", addDays(today, -56))
      .order("rowed_on", { ascending: false })
      .limit(150)
      .returns<{ id: string; sport: string; rowed_on: string; distance_m: number; time_tenths: number; workout_type: string | null; avg_watts: number | null }[]>(),
  ]);

  // Planned running km by week, and the km of plan sessions logged as done.
  const planned = new Map<string, number>();
  const fromLogs = new Map<string, number>();
  const planIds = (plans ?? []).map((p) => p.id);
  const { data: logs } = planIds.length
    ? await supabaseAdmin
        .from("plan_session_logs")
        .select("imported_plan_id, session_id, completed_quality")
        .in("imported_plan_id", planIds)
        .returns<{ imported_plan_id: string; session_id: string; completed_quality: string | null }[]>()
    : { data: [] as { imported_plan_id: string; session_id: string; completed_quality: string | null }[] };
  const logged = new Map((logs ?? []).map((l) => [`${l.imported_plan_id}:${l.session_id}`, l.completed_quality]));

  for (const p of plans ?? []) {
    for (const w of p.raw_json?.weeks ?? []) {
      const week = monday(addDays(p.effective_start_date, (Number(w.week) - 1) * 7));
      for (const s of w.sessions ?? []) {
        if (s.type !== "run") continue;
        const km = kmFromText(s.total) ?? kmFromText(s.target);
        if (!km) continue;
        planned.set(week, (planned.get(week) ?? 0) + km);
        const done = logged.get(`${p.id}:${s.id}`);
        if (done === "finished" || done === "partial") fromLogs.set(week, (fromLogs.get(week) ?? 0) + (done === "finished" ? km : km / 2));
      }
    }
  }

  // Measured km (uploaded files and typed in runs) wins over the plan's own
  // figure for sessions logged as done, when a week has both.
  const measured = new Map<string, number>();
  for (const r of runs ?? []) measured.set(monday(r.rowed_on), (measured.get(monday(r.rowed_on)) ?? 0) + r.distance_m / 1000);
  for (const f of files ?? []) {
    if (!f.distance_m) continue;
    const wk = monday(f.started_at);
    measured.set(wk, (measured.get(wk) ?? 0) + f.distance_m / 1000);
  }

  const weekList: { weekStart: string; loggedKm: number; plannedKm: number | null }[] = [];
  for (let i = 0; i < 12; i++) {
    const wk = addDays(firstWeek, i * 7);
    weekList.push({ weekStart: wk, loggedKm: measured.get(wk) ?? fromLogs.get(wk) ?? 0, plannedKm: planned.get(wk) ?? null });
  }
  const anyRunning = weekList.some((w) => w.loggedKm > 0 || (w.plannedKm ?? 0) > 0);
  const weeks = anyRunning ? markLoad(weekList) : [];
  const aboveRange = [...weeks].reverse().slice(0, 2).find((w) => w.above) ?? null;

  const g = goals ?? [];
  const t = tests ?? [];
  const copied = new Set(t.map((x) => x.rowing_result_id).filter(Boolean));
  // A test typed in by hand on the same day and of the same kind also counts
  // as already there, so the same piece is never offered twice.
  const typedIn = new Set(t.map((x) => `${x.tested_on}:${x.test_type}`));
  const candidates = (recent ?? [])
    .map(asTestCandidate)
    .filter((c): c is TestCandidate => c !== null && !copied.has(c.rowingResultId) && !typedIn.has(`${c.date}:${c.testType}`))
    .slice(0, 5);
  return { goals: g, tests: t, charts: chartsFor(g, t), weeks, aboveRange, candidates };
}
