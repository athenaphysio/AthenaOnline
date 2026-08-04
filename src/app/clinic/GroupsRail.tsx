"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./clinic.module.css";

export type GroupWithCount = { id: string; name: string; count: number };

type Props = {
  currentFilter: string; // "all" | "active" | "inactive" | "group:<id>"
  totalCount: number;
  activeCount: number;
  inactiveCount: number;
  groups: GroupWithCount[];
};

function filterHref(value: string) {
  return value === "all" ? "/clinic" : `/clinic?filter=${encodeURIComponent(value)}`;
}

export default function GroupsRail({ currentFilter, totalCount, activeCount, inactiveCount, groups }: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/clinic/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed.");
      setNewName("");
      setCreating(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRename(groupId: string) {
    if (!renameValue.trim()) return;
    try {
      const res = await fetch(`/api/clinic/groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue }),
      });
      if (!res.ok) throw new Error("Failed.");
      setRenamingId(null);
      router.refresh();
    } catch {
      // Leave the inline editor open on failure so the attempt isn't lost.
    }
  }

  async function handleDelete(groupId: string, name: string) {
    if (!confirm(`Delete "${name}"? This only removes the group -- patients themselves aren't affected.`)) return;
    try {
      const res = await fetch(`/api/clinic/groups/${groupId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed.");
      router.refresh();
    } catch {
      // Best-effort -- the rail simply won't update if this fails.
    }
  }

  return (
    <div className={styles.rail}>
      <div className={styles.railSection}>
        <Link href={filterHref("all")} className={`${styles.railRow} ${currentFilter === "all" ? styles.railRowActive : ""}`}>
          <span>All</span>
          <span className={styles.railCount}>{totalCount}</span>
        </Link>
        <Link
          href={filterHref("active")}
          className={`${styles.railRow} ${currentFilter === "active" ? styles.railRowActive : ""}`}
        >
          <span>Active</span>
          <span className={styles.railCount}>{activeCount}</span>
        </Link>
        <Link
          href={filterHref("inactive")}
          className={`${styles.railRow} ${currentFilter === "inactive" ? styles.railRowActive : ""}`}
        >
          <span>Inactive</span>
          <span className={styles.railCount}>{inactiveCount}</span>
        </Link>
      </div>

      <div className={styles.railDivider} />

      <div className={styles.railSection}>
        <div className={styles.railLabel}>Groups</div>
        {groups.map((g) => {
          const value = `group:${g.id}`;
          const isRenaming = renamingId === g.id;
          if (isRenaming) {
            return (
              <div key={g.id} className={styles.railRow} style={{ gap: 6 }}>
                <input
                  className={styles.railRenameInput}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename(g.id);
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  autoFocus
                />
                <button type="button" className={styles.iconButton} onClick={() => handleRename(g.id)} aria-label="Save">
                  ✓
                </button>
              </div>
            );
          }
          return (
            <div key={g.id} className={`${styles.railRow} ${currentFilter === value ? styles.railRowActiveGroups : ""}`}>
              <Link href={filterHref(value)} className={styles.railRowLabel}>
                {g.name}
              </Link>
              <span className={styles.railCount}>{g.count}</span>
              <button
                type="button"
                className={styles.railIconButton}
                aria-label="Rename"
                onClick={() => {
                  setRenamingId(g.id);
                  setRenameValue(g.name);
                }}
              >
                ✎
              </button>
              <button
                type="button"
                className={styles.railIconButton}
                aria-label="Delete"
                onClick={() => handleDelete(g.id, g.name)}
              >
                🗑
              </button>
            </div>
          );
        })}
        {groups.length === 0 && <p className={styles.railEmpty}>No groups yet.</p>}

        {creating ? (
          <div className={styles.railRow} style={{ gap: 6 }}>
            <input
              className={styles.railRenameInput}
              placeholder="Group name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
            <button type="button" className={styles.iconButton} disabled={saving} onClick={handleCreate} aria-label="Save">
              ✓
            </button>
          </div>
        ) : (
          <button type="button" className={styles.railAddButton} onClick={() => setCreating(true)}>
            + New group
          </button>
        )}
        {error && (
          <div className={styles.railEmpty} style={{ color: "var(--crimson)" }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
