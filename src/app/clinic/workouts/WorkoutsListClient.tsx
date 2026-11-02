"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clinicStyles from "../clinic.module.css";
import styles from "../vault/equipment/EquipmentManager.module.css";
import { DESIGNATIONS, designationLabel, type Designation } from "@/lib/designations";

export type WorkoutRow = {
  id: string;
  name: string;
  patientCount: number;
  templateUseCount: number;
  designations: Designation[];
  editedAt: string;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

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
      <div style={{ display: "flex", gap: 7, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span className={clinicStyles.chip}>
          {item.patientCount > 0
            ? `With ${item.patientCount} client${item.patientCount === 1 ? "" : "s"}`
            : "No clients yet"}
        </span>
        {item.templateUseCount > 0 && (
          <span className={clinicStyles.chip}>
            In {item.templateUseCount} template{item.templateUseCount === 1 ? "" : "s"}
          </span>
        )}
        {item.designations.map((d) => (
          <span key={d} className={clinicStyles.chip}>
            {designationLabel(d)}
          </span>
        ))}
        {formatDate(item.editedAt) && (
          <span style={{ fontSize: 12.5, color: "var(--clinic-on-canvas-muted)" }}>
            Last edited {formatDate(item.editedAt)}
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 10, alignItems: "center" }}>
        <Link href={`/clinic/workouts/${item.id}`} style={{ color: "var(--crimson-text, var(--crimson))", fontSize: 13.5 }}>
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
        {error && <span style={{ fontSize: 12.5, color: "var(--crimson-text, var(--crimson))" }}>{error}</span>}
      </div>

      {confirming && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmBox}>
            {item.patientCount > 0 ? (
              <p>
                &ldquo;{item.name}&rdquo; is currently assigned to {item.patientCount} client
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

type UseFilter = "all" | "clients" | "templates" | "unused";

const USE_FILTERS: { value: UseFilter; label: string; test: (w: WorkoutRow) => boolean }[] = [
  { value: "all", label: "All", test: () => true },
  { value: "clients", label: "With clients", test: (w) => w.patientCount > 0 },
  { value: "templates", label: "In templates", test: (w) => w.templateUseCount > 0 },
  { value: "unused", label: "Not used yet", test: (w) => w.patientCount === 0 && w.templateUseCount === 0 },
];

export default function WorkoutsListClient({ workouts }: { workouts: WorkoutRow[] }) {
  const [query, setQuery] = useState("");
  const [useFilter, setUseFilter] = useState<UseFilter>("all");
  const [designation, setDesignation] = useState<"" | Designation>("");
  const [sort, setSort] = useState<"newest" | "edited" | "name">("newest");

  // Search and the format dropdown narrow the list first, so the counts on
  // each tab always describe what that tab would show right now.
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    return workouts.filter((w) => {
      if (designation && !w.designations.includes(designation)) return false;
      if (!q) return true;
      const haystack = [w.name, ...w.designations.map(designationLabel)].join(" ").toLowerCase();
      return q.split(/\s+/).every((word) => haystack.includes(word));
    });
  }, [workouts, query, designation]);

  const visible = useMemo(() => {
    const test = USE_FILTERS.find((f) => f.value === useFilter)!.test;
    const out = searched.filter(test);
    if (sort === "name") out.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "edited") out.sort((a, b) => b.editedAt.localeCompare(a.editedAt));
    return out;
  }, [searched, useFilter, sort]);

  if (workouts.length === 0) return null;

  const selectStyle = { width: "auto", fontSize: 13.5, padding: "8px 11px" };

  return (
    <div>
      <div style={{ position: "relative", marginBottom: 12 }}>
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
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setQuery("");
          }}
          placeholder="Search workouts by name"
          aria-label="Search workouts by name"
          autoComplete="off"
          spellCheck={false}
          className={clinicStyles.input}
          style={{ paddingLeft: 42, height: 46 }}
        />
      </div>

      <div role="tablist" aria-label="Show workouts" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {USE_FILTERS.map((f) => {
          const active = f.value === useFilter;
          const count = searched.filter(f.test).length;
          return (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setUseFilter(f.value)}
              style={{
                font: "inherit",
                fontSize: 13.5,
                padding: "7px 13px",
                borderRadius: 999,
                cursor: "pointer",
                border: `1px solid ${active ? "var(--crimson)" : "var(--mist)"}`,
                background: active ? "var(--crimson)" : "var(--clinic-box)",
                color: active ? "#fff" : "var(--ink)",
              }}
            >
              {f.label} ({count})
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <select
          className={clinicStyles.input}
          style={selectStyle}
          value={designation}
          onChange={(e) => setDesignation(e.target.value as "" | Designation)}
          aria-label="Filter by format"
        >
          <option value="">Any format</option>
          {DESIGNATIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        <select
          className={clinicStyles.input}
          style={selectStyle}
          value={sort}
          onChange={(e) => setSort(e.target.value as "newest" | "edited" | "name")}
          aria-label="Sort workouts"
        >
          <option value="newest">Newest first</option>
          <option value="edited">Recently edited</option>
          <option value="name">A to Z</option>
        </select>
        <span style={{ fontSize: 12.5, color: "var(--clinic-on-canvas-muted)" }}>
          Showing {visible.length} of {workouts.length}
        </span>
      </div>

      {visible.length === 0 ? (
        <p className={clinicStyles.notice} style={{ color: "var(--clinic-on-canvas-muted)" }}>
          No workouts match that search and filter.
        </p>
      ) : (
        visible.map((w) => <WorkoutRowItem key={w.id} item={w} />)
      )}
    </div>
  );
}
