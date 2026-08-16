import Link from "next/link";
import type { CSSProperties } from "react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import styles from "../clinic.module.css";
import ClinicBrandbar from "../ClinicBrandbar";
import { CARDIO_MODALITIES, CARDIO_STRUCTURES } from "@/lib/cardioBlock";

export const dynamic = "force-dynamic";

type CardioRow = { id: string; name: string; modality: string; structure: string; created_at: string };

function label(list: { value: string; label: string }[], value: string): string {
  return list.find((item) => item.value === value)?.label ?? value;
}

export default async function CardioListPage() {
  const { data } = await supabaseAdmin
    .from("cardio_blocks")
    .select("id, name, modality, structure, created_at")
    .order("created_at", { ascending: false })
    .returns<CardioRow[]>();

  const items = data ?? [];

  return (
    <div className={styles.app}>
      <div className={styles.inner}>
        <ClinicBrandbar />

        <h1 className={styles.heading}>Cardio</h1>
        <p className={styles.subheading}>
          Reusable cardio blocks, one fixed prescription each, referenced from any Workout.
        </p>

        <div className={styles.actions} style={{ marginTop: 0, marginBottom: 20 }}>
          <Link
            href="/clinic/cardio/new"
            className={styles.buttonSecondaryAccent}
            style={{ "--zone-accent": "var(--accent-cardio)", "--zone-accent-soft": "var(--accent-cardio-soft)" } as CSSProperties}
          >
            + New cardio block
          </Link>
        </div>

        {items.length === 0 && (
          <p className={styles.notice} style={{ color: "var(--clinic-on-canvas-muted)" }}>
            No cardio blocks yet.
          </p>
        )}

        {items.map((c) => (
          <div key={c.id} className={styles.card} style={{ padding: "14px 18px", borderLeft: "4px solid var(--accent-cardio)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Link href={`/clinic/cardio/${c.id}`} className={styles.cardTitle} style={{ margin: 0, fontSize: 16 }}>
                {c.name}
              </Link>
              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
                {label(CARDIO_MODALITIES, c.modality)} · {label(CARDIO_STRUCTURES, c.structure)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
