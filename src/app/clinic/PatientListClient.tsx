"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type PatientStatus } from "@/lib/patientStatus";
import styles from "./clinic.module.css";

export type PatientListRow = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  whatTheyreOn: string;
  cyclePosition: string;
  lastActivityAt: string | null;
  status: PatientStatus;
  wearableTrackingEnabled: boolean;
  /** Invited until the client has chosen their password, then Active.
   * Awaiting approval for a client who created their own account. */
  accountStatus: "awaiting" | "invited" | "active";
  createdAt: string;
  /** The brand the client is in, or null for standard Athena. */
  brand: { id: string; name: string; accent: string; background: string } | null;
};

// A small two-colour square in the brand's own colours, with its name.
function BrandTag({ brand }: { brand: PatientListRow["brand"] }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap", fontSize: 13 }}>
      <span
        aria-hidden="true"
        style={{
          width: 14,
          height: 14,
          borderRadius: 4,
          flexShrink: 0,
          border: "1px solid rgba(0,0,0,0.15)",
          background: brand
            ? `linear-gradient(135deg, ${brand.background} 0 50%, ${brand.accent} 50% 100%)`
            : "linear-gradient(135deg, #F2EDE4 0 50%, #9B1C1C 50% 100%)",
        }}
      />
      {brand ? brand.name : "Athena Physio"}
    </span>
  );
}

type Props = {
  /** Every client, so a search can find anyone whatever filter is open. */
  rows: PatientListRow[];
  /** The clients the current filter shows when the search box is empty. */
  visibleIds: string[];
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

function fullName(row: PatientListRow): string {
  return [row.firstName, row.lastName].filter(Boolean).join(" ");
}

// Lower case with accents stripped, so "zoe" finds Zoë and "OBRIEN" finds
// O'Brien.
function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9@.\s]/g, "");
}

// Every word typed has to appear somewhere in the client's name or email,
// in any order, so "sarah jones", "jones sarah" and "jones" all find
// Sarah Jones.
function matches(row: PatientListRow, query: string): boolean {
  const haystack = fold(`${fullName(row)} ${row.email}`);
  return fold(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

export default function PatientListClient({ rows: allRows, visibleIds, groups }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const searching = query.trim() !== "";

  const rows = useMemo(() => {
    if (searching) {
      return allRows
        .filter((r) => matches(r, query))
        .sort((a, b) => fullName(a).localeCompare(fullName(b)));
    }
    const visible = new Set(visibleIds);
    return allRows.filter((r) => visible.has(r.id));
  }, [allRows, visibleIds, query, searching]);

  // Press "/" anywhere on the page to jump to the search box, unless you are
  // already typing in another field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addGroupId, setAddGroupId] = useState("");
  const [adding, setAdding] = useState(false);
  const [resending, setResending] = useState<string | null>(null);
  const [resendNote, setResendNote] = useState<Record<string, string>>({});

  async function resend(id: string) {
    setResending(id);
    try {
      const res = await fetch(`/api/clinic/clients/${id}/resend-invite`, { method: "POST" });
      const data = await res.json();
      const note = !res.ok
        ? data.error || "That did not work."
        : data.email_sent
          ? "Invitation sent again."
          : `Not sent: ${data.email_error ?? "unknown problem"}`;
      setResendNote((prev) => ({ ...prev, [id]: note }));
      if (res.ok) router.refresh();
    } catch {
      setResendNote((prev) => ({ ...prev, [id]: "That did not work." }));
    } finally {
      setResending(null);
    }
  }

  // A client who created their own account from a brand's login page.
  async function approve(id: string) {
    setResending(id);
    try {
      const res = await fetch(`/api/clinic/clients/${id}/approve`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setResendNote((prev) => ({ ...prev, [id]: data.error || "That did not work." }));
      else router.refresh();
    } catch {
      setResendNote((prev) => ({ ...prev, [id]: "That did not work." }));
    } finally {
      setResending(null);
    }
  }

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

  const searchBox = (
    <div style={{ marginBottom: 14 }}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          // Enter opens the client straight away when there is only one match.
          if (searching && rows.length === 1) router.push(`/clinic/patients/${rows[0].id}/dashboard`);
        }}
        style={{ position: "relative" }}
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          aria-hidden="true"
          style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--graphite)" }}
        >
          <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M16 16l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <input
          id="client-search"
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(new Set());
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setQuery("");
          }}
          placeholder="Search clients by name or email"
          aria-label="Search clients by name or email"
          autoComplete="off"
          spellCheck={false}
          className={styles.input}
          style={{ paddingLeft: 42, height: 46, fontSize: 15 }}
        />
      </form>
      <div style={{ fontSize: 12.5, color: "var(--clinic-on-canvas-muted)", marginTop: 6, minHeight: 18 }}>
        {searching
          ? rows.length === 0
            ? `No client matches "${query.trim()}". Check the spelling, or try their email.`
            : `${rows.length} client${rows.length === 1 ? "" : "s"} found across all clients${rows.length === 1 ? ", press Enter to open" : ""}`
          : "Tip: press / to search from anywhere on this page"}
      </div>
    </div>
  );

  // Everyone waiting for approval, whatever filter or search is open, so a
  // new sign-up from any brand is never missed.
  const awaiting = allRows.filter((r) => r.accountStatus === "awaiting");
  const signupsPanel = awaiting.length > 0 && (
    <div style={{ background: "var(--clinic-box)", borderRadius: 14, border: "1.5px solid var(--crimson)", padding: "14px 16px", marginBottom: 16 }}>
      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 10, color: "var(--charcoal)" }}>
        New sign-ups waiting for approval ({awaiting.length})
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {awaiting.map((r) => (
          <div
            key={r.id}
            style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 18px", paddingTop: 10, borderTop: "1px solid var(--mist)" }}
          >
            <div style={{ minWidth: 200, flex: "1 1 200px" }}>
              <Link href={`/clinic/patients/${r.id}/dashboard`} style={{ color: "var(--crimson)", fontWeight: 500 }}>
                {fullName(r) || r.email}
              </Link>
              <div style={{ fontSize: 12, color: "var(--graphite)" }}>{r.email}</div>
            </div>
            <BrandTag brand={r.brand} />
            <span style={{ fontSize: 12.5, color: "var(--graphite)", whiteSpace: "nowrap" }}>Signed up {relativeTime(r.createdAt)}</span>
            <button
              type="button"
              className={styles.button}
              onClick={() => approve(r.id)}
              disabled={resending === r.id}
              style={{ width: "auto", height: 34, padding: "0 16px", fontSize: 13.5 }}
            >
              {resending === r.id ? "Approving…" : "Approve"}
            </button>
            {resendNote[r.id] && <span style={{ fontSize: 12, color: "var(--graphite)" }}>{resendNote[r.id]}</span>}
          </div>
        ))}
      </div>
    </div>
  );

  if (rows.length === 0) {
    return (
      <div>
        {signupsPanel}
        {searchBox}
        {!searching && (
          <div className={styles.card}>
            <p className={styles.notice} style={{ marginTop: 0 }}>
              Nobody matches this filter.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {signupsPanel}
      {searchBox}
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
                <th style={thStyle}>Brand</th>
                <th style={thStyle}>On</th>
                <th style={thStyle}>Cycle</th>
                <th style={thStyle}>Last activity</th>
                <th style={thStyle}>Account</th>
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
                    <Link href={`/clinic/patients/${row.id}/dashboard`} style={{ color: "var(--crimson)", fontWeight: 500 }}>
                      {fullName(row)}
                    </Link>
                    <div style={{ fontSize: 12, color: "var(--graphite)" }}>{row.email}</div>
                  </td>
                  <td style={tdStyle}>
                    <BrandTag brand={row.brand} />
                  </td>
                  <td style={tdStyle}>{row.whatTheyreOn}</td>
                  <td style={tdStyle}>{row.cyclePosition}</td>
                  <td style={{ ...tdStyle, color: "var(--graphite)", whiteSpace: "nowrap" }}>
                    {relativeTime(row.lastActivityAt)}
                  </td>
                  <td style={tdStyle}>
                    <span
                      className={`${styles.statusPill} ${row.accountStatus === "active" ? styles.statusActive : styles.statusEndingSoon}`}
                    >
                      {row.accountStatus === "awaiting" ? "Awaiting approval" : row.accountStatus === "invited" ? "Invited" : "Active"}
                    </span>
                    {row.accountStatus === "awaiting" && (
                      <div>
                        <button
                          type="button"
                          onClick={() => approve(row.id)}
                          disabled={resending === row.id}
                          style={{ background: "none", border: "none", padding: 0, marginTop: 4, color: "var(--crimson)", textDecoration: "underline", cursor: "pointer", fontSize: 12.5 }}
                        >
                          {resending === row.id ? "Approving…" : "Approve"}
                        </button>
                        {resendNote[row.id] && (
                          <div style={{ fontSize: 12, color: "var(--graphite)", marginTop: 2 }}>{resendNote[row.id]}</div>
                        )}
                      </div>
                    )}
                    {row.accountStatus === "invited" && (
                      <div>
                        <button
                          type="button"
                          onClick={() => resend(row.id)}
                          disabled={resending === row.id}
                          style={{ background: "none", border: "none", padding: 0, marginTop: 4, color: "var(--crimson)", textDecoration: "underline", cursor: "pointer", fontSize: 12.5 }}
                        >
                          {resending === row.id ? "Sending…" : "Resend invite"}
                        </button>
                        {resendNote[row.id] && (
                          <div style={{ fontSize: 12, color: "var(--graphite)", marginTop: 2 }}>{resendNote[row.id]}</div>
                        )}
                      </div>
                    )}
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
