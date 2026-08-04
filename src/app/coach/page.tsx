import Image from "next/image";
import Link from "next/link";
import { requireCoach } from "@/lib/coachAuth";
import { createClient } from "@/lib/supabase/server";
import styles from "../clinic/clinic.module.css";

type TemplateRow = { id: string; name: string; block_length_weeks: number };

export default async function CoachDashboardPage() {
  const coach = await requireCoach();
  const supabase = await createClient();

  // No coach-id filter anywhere here -- RLS already scopes both queries to
  // exactly this coach's assigned templates and the programmes built from
  // them (0016_coach_rls.sql, 0017_coach_template_editing.sql). This client
  // is authenticated as this coach's own login, never the service role.
  const [{ data: templates }, { data: programmes }] = await Promise.all([
    supabase
      .from("programme_templates")
      .select("id, name, block_length_weeks")
      .order("name")
      .returns<TemplateRow[]>(),
    supabase.from("programmes").select("source_template_id").returns<{ source_template_id: string | null }[]>(),
  ]);

  const countByTemplate = new Map<string, number>();
  for (const p of programmes ?? []) {
    if (!p.source_template_id) continue;
    countByTemplate.set(p.source_template_id, (countByTemplate.get(p.source_template_id) ?? 0) + 1);
  }

  const rows = templates ?? [];

  return (
    <div className={styles.app}>
      <div className={styles.inner}>
        <div className={styles.brandbar}>
          <Image src="/icons/athena-mark.png" alt="" width={26} height={26} />
          <div className={styles.brandname}>Athena Physio — Coach</div>
        </div>

        <h1 className={styles.heading}>Hi, {coach.name || coach.email}</h1>
        <p className={styles.subheading}>
          <Link href="/coach/exercises" className={styles.canvasLink}>
            Exercise library
          </Link>
        </p>

        {rows.length === 0 && (
          <p className={styles.notice} style={{ color: "var(--clinic-on-canvas-muted)" }}>
            No templates assigned to you yet — ask David to assign you one.
          </p>
        )}

        {rows.map((t) => {
          const count = countByTemplate.get(t.id) ?? 0;
          return (
            <Link key={t.id} href={`/coach/templates/${t.id}`} style={{ display: "block", textDecoration: "none", color: "inherit" }}>
              <div className={styles.card} style={{ padding: "14px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className={styles.cardTitle} style={{ margin: 0, fontSize: 16 }}>
                    {t.name}
                  </span>
                  <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{t.block_length_weeks} week block</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--stone)", marginTop: 4 }}>
                  {count} {count === 1 ? "person" : "people"} enrolled
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
