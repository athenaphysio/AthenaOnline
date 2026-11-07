import { notFound } from "next/navigation";
import { loadCoachClient } from "@/lib/coachClient";
import { listClientDocuments } from "@/lib/clientBackground";
import CoachClientShell from "../CoachClientShell";
import styles from "../../../../clinic/patients/[id]/dashboard/ClientDashboard.module.css";

export const dynamic = "force-dynamic";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

// Files kept on the client's record, read only. Each opens through a short
// lived private link, and every opening is recorded. Shown only with
// "Documents".
export default async function CoachDocuments({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await loadCoachClient(id);
  if (!ctx.can("documents")) notFound();
  await ctx.record(["documents"]);
  const documents = await listClientDocuments(id);

  return (
    <CoachClientShell ctx={ctx} active="documents">
      <div className={styles.card} style={{ padding: 20 }}>
        <h3 style={{ margin: "0 0 12px" }}>Documents</h3>
        {documents.length === 0 && <p className={styles.muted} style={{ margin: 0 }}>No documents on this record yet.</p>}
        {documents.map((d) => (
          <div key={d.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: "10px 0", borderTop: "1px solid var(--border)" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{d.title}</div>
              <div className={styles.muted} style={{ fontSize: 13 }}>
                {d.file_name}
                {d.dated ? `, dated ${fmt(d.dated)}` : `, added ${fmt(d.uploaded_at)}`}
              </div>
            </div>
            <a className={`${styles.btn} ${styles.btnGhost}`} href={`/api/coach/clients/${id}/documents/${d.id}`} target="_blank" rel="noopener noreferrer">
              Open
            </a>
          </div>
        ))}
      </div>
    </CoachClientShell>
  );
}
