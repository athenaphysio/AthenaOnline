"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clinicStyles from "../clinic.module.css";
import styles from "../vault/equipment/EquipmentManager.module.css";

export type TemplateRow = {
  id: string;
  name: string;
  block_length_weeks: number;
  is_under_18: boolean;
  access: "paid" | "free";
  price_gbp: number | null;
  patientCount: number;
};

function TemplateCard({ item }: { item: TemplateRow }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/clinic/programme-templates/${item.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Remove failed.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed.");
      setDeleting(false);
    }
  }

  return (
    <div className={clinicStyles.card} style={{ padding: "14px 18px" }}>
      <Link href={`/clinic/programme-templates/${item.id}`} style={{ display: "block", textDecoration: "none", color: "inherit" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className={clinicStyles.cardTitle} style={{ margin: 0, fontSize: 16 }}>
            {item.name}
            {item.is_under_18 && (
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
            {item.block_length_weeks} week block &middot; {item.access === "free" ? "Free" : `£${item.price_gbp}`}
          </span>
        </div>
      </Link>
      <div style={{ marginTop: 10, display: "flex", gap: 14, alignItems: "center" }}>
        <Link href={`/clinic/programmes/new?source=template&id=${item.id}`} style={{ color: "var(--crimson)", fontSize: 13.5 }}>
          Use this template →
        </Link>
        <Link href={`/clinic/programme-templates/${item.id}/duplicate`} style={{ color: "var(--stone)", fontSize: 13.5 }}>
          Duplicate &amp; retitle
        </Link>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          style={{ background: "none", border: "none", padding: 0, font: "inherit", fontSize: 13.5, color: "var(--muted)", cursor: "pointer" }}
        >
          Remove
        </button>
        {error && <span style={{ fontSize: 12.5, color: "var(--crimson)" }}>{error}</span>}
      </div>

      {confirming && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmBox}>
            {item.patientCount > 0 ? (
              <p>
                &ldquo;{item.name}&rdquo; is currently assigned to {item.patientCount} patient
                {item.patientCount === 1 ? "" : "s"}. Removing it will affect their programme. This can&apos;t be
                undone.
              </p>
            ) : (
              <p>Remove &ldquo;{item.name}&rdquo;? This can&apos;t be undone.</p>
            )}
            <div className={styles.confirmActions}>
              <button type="button" className={clinicStyles.buttonSecondary} onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <button type="button" className={clinicStyles.button} onClick={confirmDelete} disabled={deleting}>
                {deleting ? "Removing…" : "Remove it"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProgrammeTemplatesListClient({ templates }: { templates: TemplateRow[] }) {
  return (
    <div>
      {templates.map((t) => (
        <TemplateCard key={t.id} item={t} />
      ))}
    </div>
  );
}
