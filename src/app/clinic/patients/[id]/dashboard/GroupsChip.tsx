"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./ClientDashboard.module.css";

type Group = { id: string; name: string };

type Props = {
  patientId: string;
  allGroups: Group[];
  initialGroupIds: string[];
};

// Sits with the standing and membership chips under the email, so which
// groups a client is in reads as part of who they are rather than
// something to go and look up. Reuses the patient record page's own
// endpoint and its no-save-step behaviour: every toggle sends the full
// new set immediately.
export default function GroupsChip({ patientId, allGroups, initialGroupIds }: Props) {
  const router = useRouter();
  const [groupIds, setGroupIds] = useState<Set<string>>(new Set(initialGroupIds));
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Click-away and Escape, so the menu never strands itself open over the
  // rest of the header.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function toggle(groupId: string) {
    const previous = groupIds;
    const next = new Set(groupIds);
    if (next.has(groupId)) next.delete(groupId);
    else next.add(groupId);
    setGroupIds(next);
    setSaving(groupId);
    setError(false);
    try {
      const res = await fetch(`/api/clinic/patients/${patientId}/groups`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_ids: Array.from(next) }),
      });
      if (!res.ok) throw new Error("Failed.");
      router.refresh();
    } catch {
      setGroupIds(previous);
      setError(true);
    } finally {
      setSaving(null);
    }
  }

  const mine = allGroups.filter((g) => groupIds.has(g.id));

  return (
    <div className={styles.groupsChipWrap} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.badge} ${mine.length > 0 ? styles.badgeGroups : styles.badgeNeutral} ${styles.groupsChipButton}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {mine.length > 0 ? mine.map((g) => g.name).join(", ") : "No groups"}
        <span className={styles.groupsChipCaret} aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div className={styles.groupsMenu} role="menu">
          {allGroups.length === 0 ? (
            <div className={styles.groupsMenuEmpty}>
              No groups exist yet. Create one from the patients list.
            </div>
          ) : (
            allGroups.map((g) => (
              <label key={g.id} className={styles.groupsMenuRow}>
                <input
                  type="checkbox"
                  checked={groupIds.has(g.id)}
                  disabled={saving === g.id}
                  onChange={() => toggle(g.id)}
                />
                {g.name}
              </label>
            ))
          )}
          {error && <div className={styles.groupsMenuEmpty}>That didn&apos;t save. Try again.</div>}
        </div>
      )}
    </div>
  );
}
