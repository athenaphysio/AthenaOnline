import { notFound } from "next/navigation";
import { loadCoachClient } from "@/lib/coachClient";
import { getPatientConversation } from "@/lib/messaging";
import CoachClientShell from "../CoachClientShell";
import styles from "../../../../clinic/patients/[id]/dashboard/ClientDashboard.module.css";

export const dynamic = "force-dynamic";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

// The client's conversation with the care team, read only: replies still
// come from the clinic. Shown only with "Messages".
export default async function CoachMessages({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await loadCoachClient(id);
  if (!ctx.can("messages")) notFound();
  await ctx.record(["messages"]);
  const messages = await getPatientConversation(id);

  return (
    <CoachClientShell ctx={ctx} active="messages">
      <div className={styles.card} style={{ padding: 20 }}>
        <h3 style={{ margin: "0 0 4px" }}>Messages</h3>
        <p className={styles.muted} style={{ margin: "0 0 14px", fontSize: 13 }}>
          The client&apos;s conversation with the care team. You can read it here; replies are sent from the clinic.
        </p>
        {messages.length === 0 && <p className={styles.muted} style={{ margin: 0 }}>No messages yet.</p>}
        {messages.map((m) => {
          const fromClient = m.sender === "patient";
          return (
            <div key={m.id} style={{ display: "flex", justifyContent: fromClient ? "flex-start" : "flex-end", padding: "6px 0" }}>
              <div
                style={{
                  maxWidth: "80%",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "10px 12px",
                  background: fromClient ? "transparent" : "color-mix(in srgb, var(--crimson) 8%, transparent)",
                }}
              >
                <div className={styles.label} style={{ marginBottom: 4 }}>
                  {fromClient ? ctx.access.firstName || "Client" : "Care team"} · {fmt(m.created_at)}
                </div>
                <div style={{ whiteSpace: "pre-wrap", fontSize: 14.5 }}>{m.body}</div>
              </div>
            </div>
          );
        })}
      </div>
    </CoachClientShell>
  );
}
