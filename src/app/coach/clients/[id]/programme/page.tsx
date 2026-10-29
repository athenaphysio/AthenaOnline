import { notFound } from "next/navigation";
import { loadCoachClient } from "@/lib/coachClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import CoachClientShell from "../CoachClientShell";
import styles from "../../../../clinic/patients/[id]/dashboard/ClientDashboard.module.css";

export const dynamic = "force-dynamic";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

// What the client is working on, and how their practice is going.
export default async function CoachProgramme({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await loadCoachClient(id);
  if (!ctx.can("programme")) notFound();
  await ctx.record(["programme"]);
  const [{ data: programmes }, { data: completions }] = await Promise.all([
    supabaseAdmin
      .from("programmes")
      .select("id, title, start_date, block_length_weeks, delivery_mode")
      .eq("patient_id", id)
      .is("access_paused_at", null)
      .order("created_at", { ascending: false })
      .returns<{ id: string; title: string; start_date: string | null; block_length_weeks: number; delivery_mode: string }[]>(),
    supabaseAdmin
      .from("session_completions")
      .select("occurred_at")
      .eq("patient_id", id)
      .eq("status", "completed")
      .order("occurred_at", { ascending: false })
      .returns<{ occurred_at: string }[]>(),
  ]);
  const list = programmes ?? [];
  const done = completions ?? [];

  return (
    <CoachClientShell ctx={ctx} active="programme">
      <div style={{ display: "grid", gap: 16 }}>
        <div className={styles.card} style={{ padding: 20 }}>
          <h3 style={{ margin: "0 0 8px" }}>Programme</h3>
          {list.length === 0 && <p className={styles.muted} style={{ margin: 0, fontSize: 14 }}>No programme assigned at the moment.</p>}
          {list.map((p) => (
            <div key={p.id} style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
              <div style={{ fontWeight: 600 }}>{p.title}</div>
              <div className={styles.muted} style={{ fontSize: 13 }}>
                {p.delivery_mode === "open" ? "Practices to use any time" : `${p.block_length_weeks} week programme`}
                {p.start_date && `, started ${fmt(p.start_date)}`}
              </div>
            </div>
          ))}
        </div>
        <div className={styles.card} style={{ padding: 20 }}>
          <h3 style={{ margin: "0 0 8px" }}>Practice</h3>
          <p style={{ margin: 0, fontSize: 14.5 }}>
            {done.length} practice{done.length === 1 ? "" : "s"} completed
            {done[0] ? `, most recently on ${fmt(done[0].occurred_at)}` : ""}.
          </p>
        </div>
      </div>
    </CoachClientShell>
  );
}
