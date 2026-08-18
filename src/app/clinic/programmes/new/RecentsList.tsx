"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clinicStyles from "../../clinic.module.css";
import styles from "./NewProgrammeChoice.module.css";
import type { RecentProgramme } from "@/app/api/clinic/programmes/recents/route";

type Props = {
  /** Runs the same copy Quick Build already ran for a chosen source. */
  onUse: (programmeId: string) => void;
  /** Which row is mid-copy, so only that one shows it. */
  usingId: string | null;
};

function whenLabel(iso: string): string {
  const then = new Date(iso).getTime();
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  return months <= 1 ? "last month" : `${months} months ago`;
}

// Everything already given to a client, most recent first. A multi-week
// programme and a single assigned workout both live here, because both are
// programmes -- the tag on each row says which, so they are still tellable
// apart at a glance.
export default function RecentsList({ onUse, usingId }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<RecentProgramme[] | null>(null);
  const [query, setQuery] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/clinic/programmes/recents")
      .then((res) => res.json())
      .then((data) => setRows(data.programmes ?? []))
      .catch(() => setRows([]));
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    // Name first, then what the programme actually contains, so "shoulder"
    // finds shoulder work even when the title never says it.
    return rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.patientFirstName ?? "").toLowerCase().includes(q) ||
        r.contents.includes(q)
    );
  }, [rows, query]);

  async function saveRename(id: string) {
    const title = renameValue.trim();
    if (!title) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/clinic/programmes/${id}/title`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error("Rename failed.");
      setRows((prev) => (prev ?? []).map((r) => (r.id === id ? { ...r, title } : r)));
      setRenamingId(null);
    } catch {
      // Left in place with the old name; David can try again.
    } finally {
      setBusyId(null);
    }
  }

  function duplicate(id: string) {
    // The existing "Duplicate this programme for another patient" route --
    // same deep copy, so this is one entry point to it rather than a
    // second implementation.
    router.push(`/clinic/programmes/new?source=programme&id=${id}`);
  }

  return (
    <div className={styles.recents}>
      <div className={styles.recentsHeader}>
        <h2 className={styles.recentsTitle}>Recents</h2>
        <input
          className={styles.recentsSearch}
          placeholder="Search by name, client, or what's in it (e.g. shoulder)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {rows === null && <div className={styles.recentsEmpty}>Loading…</div>}

      {rows !== null && filtered.length === 0 && (
        <div className={styles.recentsEmpty}>
          {rows.length === 0
            ? "Nothing assigned to a client yet. Once you send a programme it shows up here to reuse."
            : `Nothing matches "${query.trim()}".`}
        </div>
      )}

      {filtered.map((r) => (
        <div key={r.id} className={styles.recentRow}>
          <div className={styles.recentMain}>
            {renamingId === r.id ? (
              <input
                className={styles.recentRenameInput}
                value={renameValue}
                autoFocus
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveRename(r.id);
                  if (e.key === "Escape") setRenamingId(null);
                }}
              />
            ) : (
              <span className={styles.recentName}>{r.title}</span>
            )}
            <div className={styles.recentMeta}>
              <span className={styles.recentTag}>
                {r.deliveryMode === "open" ? "Single workout" : `${r.blockLengthWeeks} weeks`}
              </span>
              {r.workoutCount === 0 && <span className={styles.recentTagEmpty}>Empty</span>}
              {r.patientFirstName && <span>for {r.patientFirstName}</span>}
              <span>{whenLabel(r.createdAt)}</span>
            </div>
          </div>

          <div className={styles.recentActions}>
            {renamingId === r.id ? (
              <>
                <button
                  type="button"
                  className={clinicStyles.buttonSecondary}
                  style={{ width: "auto", padding: "0 14px", height: 34 }}
                  disabled={busyId === r.id}
                  onClick={() => saveRename(r.id)}
                >
                  Save
                </button>
                <button
                  type="button"
                  className={clinicStyles.buttonSecondary}
                  style={{ width: "auto", padding: "0 14px", height: 34 }}
                  onClick={() => setRenamingId(null)}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={styles.recentUseButton}
                  disabled={usingId !== null}
                  onClick={() => onUse(r.id)}
                >
                  {usingId === r.id ? "Copying…" : "Use this"}
                </button>
                <button
                  type="button"
                  className={clinicStyles.buttonSecondary}
                  style={{ width: "auto", padding: "0 14px", height: 34 }}
                  onClick={() => duplicate(r.id)}
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  className={clinicStyles.buttonSecondary}
                  style={{ width: "auto", padding: "0 14px", height: 34 }}
                  onClick={() => {
                    setRenamingId(r.id);
                    setRenameValue(r.title);
                  }}
                >
                  Rename
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
