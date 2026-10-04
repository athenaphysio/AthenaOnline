"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clinicStyles from "../../clinic.module.css";

type Item = {
  kind: "workout" | "block" | "cardio";
  id: string;
  name: string;
  detail: string;
  reason: string;
  usedBy: string | null;
};

type Result = { kind: Item["kind"]; id: string; status: "deleted" | "skipped" | "failed"; message?: string };

const GROUPS: { kind: Item["kind"]; title: string }[] = [
  { kind: "workout", title: "Workouts" },
  { kind: "block", title: "Blocks" },
  { kind: "cardio", title: "Cardio items" },
];

export default function LibraryTidyClient({ items }: { items: Item[] }) {
  const router = useRouter();
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const key = (i: Pick<Item, "kind" | "id">) => `${i.kind}:${i.id}`;

  function toggle(i: Item) {
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(key(i))) next.delete(key(i));
      else next.add(key(i));
      return next;
    });
  }

  async function deleteSelected() {
    const chosen = items.filter((i) => ticked.has(key(i)));
    if (chosen.length === 0) return;
    if (!confirm(`Delete ${chosen.length} item${chosen.length === 1 ? "" : "s"}? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/clinic/library-tidy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: chosen.map((i) => ({ kind: i.kind, id: i.id })) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "That did not work.");
      setResults(data.results);
      setTicked(new Set());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  const nameOf = (r: Result) => items.find((i) => i.kind === r.kind && i.id === r.id)?.name ?? "Item";
  const deleted = results?.filter((r) => r.status === "deleted") ?? [];
  const notDeleted = results?.filter((r) => r.status !== "deleted") ?? [];

  return (
    <div>
      {results && (
        <div className={clinicStyles.card}>
          <div className={clinicStyles.cardTitle}>
            {deleted.length} deleted{notDeleted.length > 0 ? `, ${notDeleted.length} skipped` : ""}
          </div>
          {notDeleted.map((r) => (
            <div key={`${r.kind}:${r.id}`} className={clinicStyles.warningItem}>
              {nameOf(r)}: {r.message}
            </div>
          ))}
        </div>
      )}

      {items.length === 0 && <p className={clinicStyles.notice}>Nothing left that looks like a test or leftover.</p>}

      {GROUPS.map((g) => {
        const rows = items.filter((i) => i.kind === g.kind);
        if (rows.length === 0) return null;
        return (
          <div key={g.kind} className={clinicStyles.card}>
            <div className={clinicStyles.cardTitle}>
              {g.title} ({rows.length})
            </div>
            {rows.map((i) => (
              <label
                key={i.id}
                style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", borderTop: "1px solid var(--cream)", opacity: i.usedBy ? 0.6 : 1 }}
              >
                <input
                  type="checkbox"
                  checked={ticked.has(key(i))}
                  disabled={Boolean(i.usedBy) || busy}
                  onChange={() => toggle(i)}
                  style={{ marginTop: 4 }}
                />
                <span>
                  <span style={{ fontWeight: 500 }}>{i.name}</span>
                  <span style={{ display: "block", fontSize: 12.5, color: "var(--muted)" }}>
                    {i.detail}. {i.reason}.
                  </span>
                  {i.usedBy && <span style={{ display: "block", fontSize: 12.5, color: "var(--crimson-dark)" }}>{i.usedBy}, so it stays.</span>}
                </span>
              </label>
            ))}
          </div>
        );
      })}

      {error && <div className={clinicStyles.error}>{error}</div>}

      {items.length > 0 && (
        <button
          type="button"
          className={clinicStyles.button}
          style={{ width: "auto", padding: "0 24px" }}
          disabled={ticked.size === 0 || busy}
          onClick={deleteSelected}
        >
          {busy ? "Deleting…" : `Delete selected (${ticked.size})`}
        </button>
      )}
    </div>
  );
}
