"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clinicStyles from "../clinic.module.css";
import styles from "../vault/equipment/EquipmentManager.module.css";

export type WorkoutRow = { id: string; name: string; patientCount: number; templateUseCount: number };

function WorkoutRowItem({ item }: { item: WorkoutRow }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/clinic/workouts/${item.id}`, { method: "DELETE" });
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
      <span className={clinicStyles.cardTitle} style={{ margin: 0, fontSize: 16 }}>
        {item.name}
      </span>
      <div style={{ display: "flex", gap: 14, marginTop: 10, alignItems: "center" }}>
        <Link href={`/clinic/workouts/${item.id}`} style={{ color: "var(--crimson)", fontSize: 13.5 }}>
          Edit
        </Link>
        <Link href={`/clinic/workouts/${item.id}/duplicate`} style={{ color: "var(--stone)", fontSize: 13.5 }}>
          Duplicate
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
            ) : item.templateUseCount > 0 ? (
              <p>
                &ldquo;{item.name}&rdquo; is used inside {item.templateUseCount} Programme Template
                {item.templateUseCount === 1 ? "" : "s"}. Remove it from{" "}
                {item.templateUseCount === 1 ? "that template" : "those templates"} first.
              </p>
            ) : (
              <p>Remove &ldquo;{item.name}&rdquo;? This can&apos;t be undone.</p>
            )}
            <div className={styles.confirmActions}>
              <button type="button" className={clinicStyles.buttonSecondary} onClick={() => setConfirming(false)}>
                Cancel
              </button>
              {item.templateUseCount === 0 && (
                <button type="button" className={clinicStyles.button} onClick={confirmDelete} disabled={deleting}>
                  {deleting ? "Removing…" : "Remove it"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WorkoutsListClient({ workouts }: { workouts: WorkoutRow[] }) {
  return (
    <div>
      {workouts.map((w) => (
        <WorkoutRowItem key={w.id} item={w} />
      ))}
    </div>
  );
}
