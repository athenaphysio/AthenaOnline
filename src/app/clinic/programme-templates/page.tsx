import Link from "next/link";
import type { CSSProperties } from "react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import styles from "../clinic.module.css";
import ClinicBrandbar from "../ClinicBrandbar";
import ProgrammeTemplatesListClient, { type TemplateRow } from "./ProgrammeTemplatesListClient";

// See the matching comment on src/app/clinic/page.tsx -- this page has no
// dynamic API to trigger dynamic rendering automatically, so without this
// it would freeze at whatever the template list looked like at build time.
export const dynamic = "force-dynamic";

export default async function ProgrammeTemplatesListPage() {
  const [{ data: templates }, { data: programmeLinks }] = await Promise.all([
    supabaseAdmin
      .from("programme_templates")
      .select("id, name, block_length_weeks, is_under_18, access, price_gbp, created_at")
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("programmes")
      .select("source_template_id, patient_id")
      .not("source_template_id", "is", null)
      .returns<{ source_template_id: string; patient_id: string }[]>(),
  ]);

  const patientIdsByTemplate = new Map<string, Set<string>>();
  for (const link of programmeLinks ?? []) {
    if (!patientIdsByTemplate.has(link.source_template_id)) patientIdsByTemplate.set(link.source_template_id, new Set());
    patientIdsByTemplate.get(link.source_template_id)!.add(link.patient_id);
  }

  const rows: TemplateRow[] = (templates ?? []).map((t) => ({
    ...t,
    patientCount: patientIdsByTemplate.get(t.id)?.size ?? 0,
  }));

  return (
    <div className={styles.app}>
      <div className={styles.inner}>
        <ClinicBrandbar />

        <h1 className={styles.heading}>Programme Templates</h1>
        <p className={styles.subheading}>
          Reusable, patient-agnostic schedules. Use one to start a new patient's programme, or promote a
          proven bespoke programme into the library from its edit page.
        </p>

        <div className={styles.actions} style={{ marginTop: 0, marginBottom: 20 }}>
          <Link
            href="/clinic/programme-templates/new"
            className={styles.buttonSecondaryAccent}
            style={{ "--zone-accent": "var(--accent-content)", "--zone-accent-soft": "var(--accent-content-soft)" } as CSSProperties}
          >
            + New template
          </Link>
        </div>

        {rows.length === 0 && (
          <p className={styles.notice} style={{ color: "var(--clinic-on-canvas-muted)" }}>
            No templates yet.
          </p>
        )}

        <ProgrammeTemplatesListClient templates={rows} />
      </div>
    </div>
  );
}
