import { loadCoachClient } from "@/lib/coachClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sectionLabel } from "@/lib/clinicianAccessSections";
import CoachClientShell from "../CoachClientShell";
import CoachNoteForm from "../CoachNoteForm";
import styles from "../../../../clinic/patients/[id]/dashboard/ClientDashboard.module.css";

export const dynamic = "force-dynamic";

// Notes the care team keep about this client, each filed against a part of
// the record and seen only by those who can see that part.
export default async function CoachNotes({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await loadCoachClient(id);
  const visible = ctx.access.sections.filter((s) => s !== "write_notes");
  const { data } = await supabaseAdmin
    .from("care_notes")
    .select("id, section, author_name, body, created_at")
    .eq("patient_id", id)
    .in("section", visible)
    .order("created_at", { ascending: false })
    .returns<{ id: string; section: string; author_name: string; body: string; created_at: string }[]>();
  const notes = data ?? [];
  await ctx.record(Array.from(new Set(notes.map((n) => n.section))));

  return (
    <CoachClientShell ctx={ctx} active="notes">
      <div className={styles.card} style={{ padding: 20 }}>
        <h3 style={{ margin: "0 0 8px" }}>Care team notes</h3>
        {ctx.can("write_notes") && <CoachNoteForm patientId={id} sections={visible.map((s) => ({ key: s, label: sectionLabel(s) }))} />}
        {notes.length === 0 && <p className={styles.muted} style={{ fontSize: 14 }}>No notes yet.</p>}
        {notes.map((n) => (
          <div key={n.id} style={{ borderTop: "1px solid var(--border)", padding: "10px 0", marginTop: 8 }}>
            <div className={styles.muted} style={{ fontSize: 12.5 }}>
              {n.author_name}, {sectionLabel(n.section)}, {new Date(n.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
            </div>
            <div style={{ fontSize: 14, whiteSpace: "pre-wrap", marginTop: 2 }}>{n.body}</div>
          </div>
        ))}
      </div>
    </CoachClientShell>
  );
}
