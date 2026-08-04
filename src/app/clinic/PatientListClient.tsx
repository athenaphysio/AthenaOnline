"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type PatientStatus } from "@/lib/patientStatus";
import styles from "./clinic.module.css";

export type PatientListRow = {
  id: string;
  firstName: string;
  email: string;
  whatTheyreOn: string;
  cyclePosition: string;
  lastActivityAt: string | null;
  status: PatientStatus;
  wearableTrackingEnabled: boolean;
};

type Props = {
  rows: PatientListRow[];
  groups: { id: string; name: string }[];
};

const STATUS_LABEL: Record<PatientStatus, string> = {
  brand_new: "Brand new",
  no_programme: "No programme",
  active: "Active",
  ending_soon: "Ending soon",
  lapsed: "Lapsed",
  block_ended: "Block ended",
};

const STATUS_CLASS: Record<PatientStatus, string> = {
  brand_new: styles.statusBrandNew,
  no_programme: styles.statusNoProgramme,
  active: styles.statusActive,
  ending_soon: styles.statusEndingSoon,
  lapsed: styles.statusLapsed,
  block_ended: styles.statusBlockEnded,
};

function relativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

export default function PatientListClient({ rows, groups }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addGroupId, setAddGroupId] = useState("");
  const [adding, setAdding] = useState(false);

  const allSelected = rows.length > 0 && selected.size === rows.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  async function handleAddToGroup() {
    if (!addGroupId || selected.size === 0) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/clinic/groups/${addGroupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_ids: Array.from(selected) }),
      });
      if (!res.ok) throw new Error("Failed.");
      setSelected(new Set());
      setAddGroupId("");
      router.refresh();
    } catch {
      // Best-effort -- the bar just stays open so David can try again.
    } finally {
      setAdding(false);
    }
  }

  if (rows.length === 0) {
    return (
      <div className={styles.card}>
        <p className={styles.notice} style={{ marginTop: 0 }}>
          Nobody matches this filter.
        </p>
      </div>
    );
  }

  return (
    <div>
      {selected.size > 0 && (
        <div className={styles.bulkBar}>
          <span>
            {selected.size} selected
          </span>
          <select
            className={styles.bulkSelect}
            value={addGroupId}
            onChange={(e) => setAddGroupId(e.target.value)}
          >
            <option value="">Add to group…</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={styles.buttonSecondary}
            style={{ width: "auto", padding: "0 16px", height: 34 }}
            disabled={!addGroupId || adding}
            onClick={handleAddToGroup}
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
      )}

      {/* The list is a light box floating on the clinic's crimson canvas --
          same "lighter boxes" treatment as every card elsewhere, just as a
          table rather than a stack of cards. */}
      <div style={{ background: "var(--clinic-box)", borderRadius: 14, border: "1px solid var(--mist)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14.5 }}>
            <thead>
              <tr>
                <th style={{ padding: "8px 10px", borderBottom: "1px solid var(--mist)", width: 28 }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
                </th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>On</th>
                <th style={thStyle}>Cycle</th>
                <th style={thStyle}>Last activity</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Wearable</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td style={tdStyle}>
                    <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} />
                  </td>
                  <td style={tdStyle}>
                    <Link href={`/clinic/patients/${row.id}`} style={{ color: "var(--crimson)", fontWeight: 500 }}>
                      {row.firstName}
                    </Link>
                    <div style={{ fontSize: 12, color: "var(--graphite)" }}>{row.email}</div>
                  </td>
                  <td style={tdStyle}>{row.whatTheyreOn}</td>
                  <td style={tdStyle}>{row.cyclePosition}</td>
                  <td style={{ ...tdStyle, color: "var(--graphite)", whiteSpace: "nowrap" }}>
                    {relativeTime(row.lastActivityAt)}
                  </td>
                  <td style={tdStyle}>
                    <span className={`${styles.statusPill} ${STATUS_CLASS[row.status]}`}>{STATUS_LABEL[row.status]}</span>
                  </td>
                  <td style={tdStyle}>
                    {row.wearableTrackingEnabled && (
                      <span className={`${styles.statusPill} ${styles.statusActive}`}>On</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  borderBottom: "1px solid var(--mist)",
  color: "var(--graphite)",
  fontWeight: 500,
  fontSize: 12.5,
};

const tdStyle: CSSProperties = {
  padding: "12px 10px",
  borderBottom: "1px solid var(--mist)",
  verticalAlign: "top",
  color: "var(--ink)",
};
