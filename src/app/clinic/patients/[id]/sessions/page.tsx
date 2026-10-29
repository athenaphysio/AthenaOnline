import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ClientRecordShell from "../ClientRecordShell";
import styles from "../dashboard/ClientDashboard.module.css";

export const dynamic = "force-dynamic";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Completion = { programme_id: string; week_number: number; day_of_week: number; status: string; occurred_at: string };
type CardLog = {
  programme_id: string;
  workout_id: string;
  week_number: number;
  completed_quality: string | null;
  pain_score: number | null;
  note: string | null;
  next_morning_answer: string | null;
  completed_at: string;
};

// Sessions: the weekly plan for the current programme, and every practice
// the client has logged in the app, newest first. Clinic visits are not
// shown, since they live in Cliniko and Setmore rather than here.
export default async function SessionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ data: programmes }, { data: completions }, { data: logs }] = await Promise.all([
    supabaseAdmin
      .from("programmes")
      .select("id, title, delivery_mode, access_paused_at")
      .eq("patient_id", id)
      .order("created_at", { ascending: false })
      .returns<{ id: string; title: string; delivery_mode: string; access_paused_at: string | null }[]>(),
    supabaseAdmin
      .from("session_completions")
      .select("programme_id, week_number, day_of_week, status, occurred_at")
      .eq("patient_id", id)
      .order("occurred_at", { ascending: false })
      .returns<Completion[]>(),
    supabaseAdmin
      .from("programme_card_logs")
      .select("programme_id, workout_id, week_number, completed_quality, pain_score, note, next_morning_answer, completed_at")
      .eq("patient_id", id)
      .order("completed_at", { ascending: false })
      .returns<CardLog[]>(),
  ]);

  const titleOf = new Map((programmes ?? []).map((p) => [p.id, p.title]));
  const scheduled = (programmes ?? []).find((p) => p.delivery_mode === "scheduled" && !p.access_paused_at) ?? null;
  const { data: week } = scheduled
    ? await supabaseAdmin
        .from("programme_workouts")
        .select("day_of_week, workouts(name)")
        .eq("programme_id", scheduled.id)
        .returns<{ day_of_week: number | null; workouts: { name: string } | null }[]>()
    : { data: null };

  const workoutIds = Array.from(new Set((logs ?? []).map((l) => l.workout_id)));
  const { data: workouts } = workoutIds.length
    ? await supabaseAdmin.from("workouts").select("id, name").in("id", workoutIds).returns<{ id: string; name: string }[]>()
    : { data: [] };
  const workoutName = new Map((workouts ?? []).map((w) => [w.id, w.name]));

  // One list of everything logged, newest first. Repeated exercise ticks on
  // the same day collapse into one practice.
  type Row = { at: string; title: string; detail: string; status: "completed" | "skipped" | "logged"; note?: string | null };
  const rows: Row[] = [];
  const seen = new Set<string>();
  for (const c of completions ?? []) {
    const key = `${c.programme_id}:${c.week_number}:${c.day_of_week}:${c.status}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      at: c.occurred_at,
      title: titleOf.get(c.programme_id) ?? "Programme",
      detail: `Week ${c.week_number}, ${DAYS[c.day_of_week - 1] ?? ""}`,
      status: c.status === "skipped" ? "skipped" : "completed",
    });
  }
  for (const l of logs ?? []) {
    const bits = [
      `Week ${l.week_number}`,
      l.completed_quality ? `felt ${l.completed_quality.replace(/_/g, " ")}` : null,
      l.pain_score != null ? `pain ${l.pain_score}/10` : null,
      l.next_morning_answer ? `next morning: ${l.next_morning_answer.replace(/_/g, " ")}` : null,
    ].filter(Boolean);
    rows.push({ at: l.completed_at, title: workoutName.get(l.workout_id) ?? "Session", detail: bits.join(", "), status: "logged", note: l.note });
  }
  rows.sort((a, b) => b.at.localeCompare(a.at));

  return (
    <ClientRecordShell patientId={id} active="sessions">
      {scheduled && (
        <div className={styles.card} style={{ marginBottom: 18 }}>
          <h3 style={{ marginBottom: 12 }}>This week&apos;s plan, {scheduled.title}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 8 }}>
            {DAYS.map((label, i) => {
              const w = (week ?? []).find((x) => x.day_of_week === i + 1);
              return (
                <div key={label} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "10px 8px", minHeight: 74 }}>
                  <div className={styles.label}>{label}</div>
                  <div style={{ fontSize: 13, marginTop: 6, fontWeight: w ? 600 : 400, opacity: w ? 1 : 0.6 }}>{w?.workouts?.name ?? "Rest"}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className={styles.card}>
        <h3 style={{ marginBottom: 4 }}>Session history</h3>
        <p className={styles.muted} style={{ margin: "0 0 12px", fontSize: 13 }}>
          Everything logged in the app. Clinic visits are kept in Cliniko and Setmore, so they do not appear here.
        </p>
        {rows.length === 0 && <p className={styles.muted} style={{ margin: 0 }}>Nothing logged yet.</p>}
        {rows.map((r, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "120px minmax(0, 1fr) auto", gap: 12, padding: "10px 0", borderTop: "1px solid var(--border)", alignItems: "start" }}>
            <div className={styles.muted} style={{ fontSize: 13 }}>
              {new Date(r.at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{r.title}</div>
              <div className={styles.muted} style={{ fontSize: 13 }}>{r.detail}</div>
              {r.note && <div style={{ fontSize: 13.5, marginTop: 4 }}>&ldquo;{r.note}&rdquo;</div>}
            </div>
            <span className={`${styles.badge} ${r.status === "skipped" ? styles.badgeNeutral : styles.badgeActive}`}>
              {r.status === "skipped" ? "Skipped" : r.status === "logged" ? "Logged" : "Done"}
            </span>
          </div>
        ))}
      </div>
    </ClientRecordShell>
  );
}
