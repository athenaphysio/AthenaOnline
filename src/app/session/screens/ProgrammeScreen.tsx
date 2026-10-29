import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ClientShell from "../ClientShell";
import type { ClientAppContext } from "@/lib/clientApp";
import styles from "./Screens.module.css";

type Row = { id: string; title: string; delivery_mode: "scheduled" | "open"; start_date: string; block_length_weeks: number };

function weekOf(start: string, weeks: number): string | null {
  const days = Math.floor((Date.now() - new Date(start).getTime()) / 86_400_000);
  if (days < 0) return `Starts ${new Date(start).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}`;
  const week = Math.floor(days / 7) + 1;
  return week <= weeks ? `Week ${week} of ${weeks}` : `All ${weeks} weeks complete`;
}

// The Programme tab: what the client is working on, with a way into each.
export default async function ProgrammeScreen({ ctx }: { ctx: ClientAppContext }) {
  const { data } = await supabaseAdmin
    .from("programmes")
    .select("id, title, delivery_mode, start_date, block_length_weeks")
    .eq("patient_id", ctx.userId)
    .is("access_paused_at", null)
    .order("created_at", { ascending: false })
    .returns<Row[]>();
  const programmes = data ?? [];
  const scheduled = programmes.filter((p) => p.delivery_mode === "scheduled");
  const open = programmes.filter((p) => p.delivery_mode === "open");

  return (
    <ClientShell ctx={ctx} active="programme" title="Your programme" lead="This is what we are working on, and each practice explains why it is there.">
      <div className={styles.stack}>
        {programmes.length === 0 && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Nothing here yet</h2>
            <p className={styles.muted}>
              Your programme will appear here once it has been built with you, usually straight after your first assessment.
            </p>
          </div>
        )}
        {scheduled.map((p) => (
          <div key={p.id} className={styles.card}>
            <h2 className={styles.cardTitle}>{p.title}</h2>
            <p className={styles.muted}>{weekOf(p.start_date, p.block_length_weeks)}</p>
            <Link href={`/session/${p.id}`} className={styles.link}>
              Open today&apos;s practice →
            </Link>
          </div>
        ))}
        {open.length > 0 && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Practices to use any time</h2>
            {open.map((p) => (
              <Link key={p.id} href={`/session/${p.id}`} className={styles.rowLink}>
                {p.title} →
              </Link>
            ))}
          </div>
        )}
      </div>
    </ClientShell>
  );
}
