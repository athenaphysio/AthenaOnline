import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import styles from "../clinic.module.css";
import ClinicBrandbar from "../ClinicBrandbar";

// See the matching comment on src/app/clinic/page.tsx -- this page has no
// dynamic API to trigger dynamic rendering automatically, so without this
// it would freeze at whatever the template list looked like at build time.
export const dynamic = "force-dynamic";

type TemplateRow = {
  id: string;
  name: string;
  block_length_weeks: number;
  is_under_18: boolean;
  access: "paid" | "free";
  price_gbp: number | null;
  created_at: string;
};

export default async function ProgrammeTemplatesListPage() {
  const { data } = await supabaseAdmin
    .from("programme_templates")
    .select("id, name, block_length_weeks, is_under_18, access, price_gbp, created_at")
    .order("created_at", { ascending: false })
    .returns<TemplateRow[]>();

  const templates = data ?? [];

  return (
    <div className={styles.app}>
      <div className={styles.inner}>
        <ClinicBrandbar />

        <h1 className={styles.heading}>Programme Templates</h1>
        <p className={styles.subheading}>
          Reusable, patient-agnostic schedules. Use one to start a new patient's programme, or promote a
          proven bespoke programme into the library from its edit page.{" "}
          <Link href="/clinic/content" className={styles.canvasLink}>
            ← Content
          </Link>
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

        {templates.length === 0 && (
          <p className={styles.notice} style={{ color: "var(--clinic-on-canvas-muted)" }}>
            No templates yet.
          </p>
        )}

        {templates.map((t) => (
          <div key={t.id} className={styles.card} style={{ padding: "14px 18px" }}>
            <Link
              href={`/clinic/programme-templates/${t.id}`}
              style={{ display: "block", textDecoration: "none", color: "inherit" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className={styles.cardTitle} style={{ margin: 0, fontSize: 16 }}>
                  {t.name}
                  {t.is_under_18 && (
                    <span
                      style={{
                        marginLeft: 10,
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--crimson)",
                        border: "1px solid var(--crimson)",
                        borderRadius: 6,
                        padding: "2px 7px",
                        verticalAlign: "middle",
                      }}
                    >
                      Under-18
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
                  {t.block_length_weeks} week block · {t.access === "free" ? "Free" : `£${t.price_gbp}`}
                </span>
              </div>
            </Link>
            <div style={{ marginTop: 10, display: "flex", gap: 14 }}>
              <Link
                href={`/clinic/programmes/new?source=template&id=${t.id}`}
                style={{ color: "var(--crimson)", fontSize: 13.5 }}
              >
                Use this template →
              </Link>
              <Link href={`/clinic/programme-templates/${t.id}/duplicate`} style={{ color: "var(--stone)", fontSize: 13.5 }}>
                Duplicate &amp; retitle
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
