import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import styles from "../clinic.module.css";
import ClinicBrandbar from "../ClinicBrandbar";

// See the matching comment on src/app/clinic/page.tsx -- this page has no
// dynamic API to trigger dynamic rendering automatically, so without this
// it would freeze at whatever the programme list looked like at build time.
export const dynamic = "force-dynamic";

type ProgrammeRow = {
  id: string;
  patient_first_name: string;
  title: string;
  block_length_weeks: number;
  created_at: string;
};

export default async function ProgrammesListPage() {
  const { data } = await supabaseAdmin
    .from("programmes")
    .select("id, patient_first_name, title, block_length_weeks, created_at")
    .order("created_at", { ascending: false })
    .returns<ProgrammeRow[]>();

  const programmes = data ?? [];

  return (
    <div className={styles.app}>
      <div className={styles.inner}>
        <ClinicBrandbar />

        <h1 className={styles.heading}>Programmes</h1>
        <p className={styles.subheading}>
          Which Workout runs on which day, per patient.{" "}
          <Link href="/clinic/content" className={styles.canvasLink}>
            ← Content
          </Link>
        </p>

        <div className={styles.actions} style={{ marginTop: 0, marginBottom: 20 }}>
          <Link
            href="/clinic/programmes/new"
            className={styles.buttonSecondaryAccent}
            style={{ "--zone-accent": "var(--accent-content)", "--zone-accent-soft": "var(--accent-content-soft)" } as CSSProperties}
          >
            + New programme
          </Link>
        </div>

        {programmes.length === 0 && (
          <p className={styles.notice} style={{ color: "var(--clinic-on-canvas-muted)" }}>
            No programmes yet.
          </p>
        )}

        {programmes.map((p) => (
          <div key={p.id} className={styles.card} style={{ padding: "14px 18px" }}>
            <Link
              href={`/clinic/programmes/${p.id}`}
              style={{ display: "block", textDecoration: "none", color: "inherit" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className={styles.cardTitle} style={{ margin: 0, fontSize: 16 }}>
                  {p.patient_first_name}
                  <span className={styles.exerciseId}>{p.title}</span>
                </span>
                <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
                  {p.block_length_weeks} week block
                </span>
              </div>
            </Link>
            <div style={{ marginTop: 10 }}>
              <Link
                href={`/clinic/programmes/new?source=programme&id=${p.id}`}
                style={{ color: "var(--stone)", fontSize: 13.5 }}
              >
                Duplicate &amp; retitle
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
