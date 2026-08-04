import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import styles from "../clinic.module.css";
import ClinicBrandbar from "../ClinicBrandbar";

// See the matching comment on src/app/clinic/page.tsx -- this page has no
// dynamic API to trigger dynamic rendering automatically, so without this
// it would freeze at whatever the form list looked like at build time.
export const dynamic = "force-dynamic";

type FormRow = { id: string; title: string; created_at: string };

export default async function FormsListPage() {
  const { data } = await supabaseAdmin
    .from("forms")
    .select("id, title, created_at")
    .order("created_at", { ascending: false })
    .returns<FormRow[]>();

  const forms = data ?? [];

  return (
    <div className={styles.app}>
      <div className={styles.inner}>
        <ClinicBrandbar />

        <h1 className={styles.heading}>Forms</h1>
        <p className={styles.subheading}>
          Build a form once, send it to a patient or a group whenever you need it.{" "}
          <Link href="/clinic/content" className={styles.canvasLink}>
            ← Content
          </Link>
        </p>

        <div className={styles.actions} style={{ marginTop: 0, marginBottom: 20 }}>
          <Link
            href="/clinic/forms/new"
            className={styles.buttonSecondaryAccent}
            style={{ "--zone-accent": "var(--accent-forms)", "--zone-accent-soft": "var(--accent-forms-soft)" } as CSSProperties}
          >
            + New form
          </Link>
        </div>

        {forms.length === 0 && (
          <p className={styles.notice} style={{ color: "var(--clinic-on-canvas-muted)" }}>
            No forms yet.
          </p>
        )}

        {forms.map((f) => (
          <Link
            key={f.id}
            href={`/clinic/forms/${f.id}`}
            className={styles.card}
            style={{ display: "block", padding: "14px 18px", textDecoration: "none", color: "inherit" }}
          >
            <span className={styles.cardTitle} style={{ margin: 0, fontSize: 16 }}>
              {f.title}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
