"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clinicStyles from "../../clinic.module.css";
import styles from "../equipment/EquipmentManager.module.css";

export type LadderRow = { id: string; name: string; phase_label: string | null; active: boolean; rungCount: number };

function ActiveToggle({ ladder }: { ladder: LadderRow }) {
  const router = useRouter();
  const [active, setActive] = useState(ladder.active);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    const next = !active;
    setSaving(true);
    try {
      const res = await fetch(`/api/clinic/vault/running-ladders/${ladder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: next }),
      });
      if (res.ok) {
        setActive(next);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      type="button"
      className={clinicStyles.buttonSecondary}
      style={{ width: "auto", padding: "0 14px", height: 32, fontSize: 12.5 }}
      onClick={toggle}
      disabled={saving}
    >
      {active ? "Active, switch off" : "Off, switch on"}
    </button>
  );
}

function LadderRowItem({ item }: { item: LadderRow }) {
  const router = useRouter();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/clinic/vault/running-ladders/${item.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
      setDeleting(false);
    }
  }

  return (
    <div className={styles.row}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Link href={`/clinic/vault/running-ladders/${item.id}`} className={styles.name} style={{ textDecoration: "underline" }}>
          {item.name}
        </Link>
        {item.phase_label && <div className={styles.usageCount}>{item.phase_label}</div>}
      </div>

      <div className={styles.usageCount}>
        {item.rungCount === 0 ? "No rungs yet" : `${item.rungCount} rung${item.rungCount === 1 ? "" : "s"}`}
      </div>

      <div className={styles.actions}>
        <ActiveToggle ladder={item} />
        <Link
          href={`/clinic/vault/running-ladders/${item.id}`}
          className={clinicStyles.buttonSecondary}
          style={{ width: "auto", padding: "0 16px", height: 34, display: "inline-flex", alignItems: "center" }}
        >
          Edit
        </Link>
        <button
          type="button"
          className={clinicStyles.buttonSecondary}
          style={{ width: "auto", padding: "0 16px", height: 34 }}
          onClick={() => setConfirmingDelete(true)}
        >
          Remove
        </button>
        {error && <span className={styles.error}>{error}</span>}
      </div>

      {confirmingDelete && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmBox}>
            <p>
              {item.rungCount > 0
                ? `"${item.name}" has ${item.rungCount} rung${item.rungCount === 1 ? "" : "s"} on it. Removing it deletes those too. This can't be undone.`
                : `Remove "${item.name}"? It has no rungs yet, so this is safe.`}
            </p>
            <div className={styles.confirmActions}>
              <button type="button" className={clinicStyles.buttonSecondary} onClick={() => setConfirmingDelete(false)}>
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

function AddLadderForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phaseLabel, setPhaseLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/clinic/vault/running-ladders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phase_label: phaseLabel.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed.");
      setName("");
      setPhaseLabel("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.addForm}>
      <input
        className={styles.nameInput}
        placeholder="New ladder name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ flex: 2 }}
      />
      <input
        className={styles.nameInput}
        placeholder="Phase label (optional)"
        value={phaseLabel}
        onChange={(e) => setPhaseLabel(e.target.value)}
        style={{ flex: 1 }}
      />
      <button type="button" className={clinicStyles.button} style={{ width: "auto", padding: "0 20px" }} onClick={save} disabled={saving}>
        {saving ? "Adding…" : "Add ladder"}
      </button>
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}

export default function RunningLaddersManagerClient({ ladders }: { ladders: LadderRow[] }) {
  return (
    <div>
      <AddLadderForm />
      {ladders.map((item) => (
        <LadderRowItem key={item.id} item={item} />
      ))}
    </div>
  );
}
