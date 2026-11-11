"use client";

import { useState } from "react";
import { doseText, type CircuitExercise, type CircuitLibrary, type LibraryCircuitBlock, type LibraryCircuitSet } from "@/lib/runCircuit";
import CircuitExerciseEditor, { type ExerciseChoice } from "./CircuitExerciseEditor";
import styles from "../clinic.module.css";

type BlockDraft = { id: string | null; name: string; notes: string; exercises: CircuitExercise[] };
type SetDraft = { id: string | null; name: string; notes: string; block_ids: string[] };

type Editing = { kind: "block"; draft: BlockDraft } | { kind: "set"; draft: SetDraft } | null;

type Props = {
  initialLibrary: CircuitLibrary;
  exercises: ExerciseChoice[];
  startNewBlock: boolean;
};

const emptyBlock = (): BlockDraft => ({ id: null, name: "", notes: "", exercises: [] });
const emptySet = (): SetDraft => ({ id: null, name: "", notes: "", block_ids: [] });

function RunSlot() {
  return (
    <div
      style={{
        border: "1px dashed var(--accent-cardio, #9B1C1C)",
        borderRadius: 9,
        padding: "9px 12px",
        marginBottom: 10,
        fontSize: 13.5,
        color: "var(--muted)",
      }}
    >
      <strong style={{ color: "var(--graphite, inherit)" }}>Run slot.</strong> The run time, effort or treadmill speed, and the walk after this block are set
      by the plan for each client.
    </div>
  );
}

export default function RunCircuitsClient({ initialLibrary, exercises, startNewBlock }: Props) {
  const [library, setLibrary] = useState<CircuitLibrary>(initialLibrary);
  const [editing, setEditing] = useState<Editing>(startNewBlock ? { kind: "block", draft: emptyBlock() } : null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const res = await fetch("/api/clinic/run-circuits");
    if (res.ok) setLibrary((await res.json()) as CircuitLibrary);
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const body = editing.kind === "block" ? { kind: "block", ...editing.draft } : { kind: "set", ...editing.draft };
      const id = editing.draft.id;
      const res = await fetch(id ? `/api/clinic/run-circuits/${id}` : "/api/clinic/run-circuits", {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "That didn't save.");
      await reload();
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't save.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!editing?.draft.id) return;
    const what = editing.kind === "block" ? "this circuit block" : "this phase set";
    if (!window.confirm(`Delete ${what}? Programmes already built keep their own copy.`)) return;
    setSaving(true);
    try {
      await fetch(`/api/clinic/run-circuits/${editing.draft.id}?kind=${editing.kind}`, { method: "DELETE" });
      await reload();
      setEditing(null);
    } finally {
      setSaving(false);
    }
  }

  const blockById = new Map(library.blocks.map((b) => [b.id, b]));

  if (editing?.kind === "block") {
    const d = editing.draft;
    const set = (patch: Partial<BlockDraft>) => setEditing({ kind: "block", draft: { ...d, ...patch } });
    return (
      <div className={styles.card} style={{ padding: "18px 20px" }}>
        <h2 className={styles.cardTitle}>{d.id ? "Edit circuit block" : "New circuit block"}</h2>
        <div className={styles.field}>
          <label className={styles.label}>Name</label>
          <input className={styles.input} value={d.name} placeholder="Block A" onChange={(e) => set({ name: e.target.value })} />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Notes for you and the Programme Builder (optional)</label>
          <textarea className={styles.textarea} style={{ minHeight: 60 }} value={d.notes} onChange={(e) => set({ notes: e.target.value })} />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>In this block</label>
          <RunSlot />
          <CircuitExerciseEditor exercises={d.exercises} library={exercises} onChange={(next) => set({ exercises: next })} />
        </div>
        {error && <div className={styles.error}>{error}</div>}
        <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={save} disabled={saving || !d.name.trim()}>
            {saving ? "Saving…" : "Save block"}
          </button>
          <button type="button" className={styles.buttonSecondary} onClick={() => setEditing(null)} disabled={saving}>
            Cancel
          </button>
          {d.id && (
            <button type="button" className={styles.buttonDestructive} onClick={remove} disabled={saving}>
              Delete
            </button>
          )}
        </div>
      </div>
    );
  }

  if (editing?.kind === "set") {
    const d = editing.draft;
    const set = (patch: Partial<SetDraft>) => setEditing({ kind: "set", draft: { ...d, ...patch } });
    const available = library.blocks.filter((b) => !d.block_ids.includes(b.id));
    const move = (i: number, by: number) => {
      const j = i + by;
      if (j < 0 || j >= d.block_ids.length) return;
      const next = [...d.block_ids];
      [next[i], next[j]] = [next[j], next[i]];
      set({ block_ids: next });
    };
    return (
      <div className={styles.card} style={{ padding: "18px 20px" }}>
        <h2 className={styles.cardTitle}>{d.id ? "Edit phase set" : "New phase set"}</h2>
        <div className={styles.field}>
          <label className={styles.label}>Name</label>
          <input className={styles.input} value={d.name} placeholder="Return to Run Phase 1" onChange={(e) => set({ name: e.target.value })} />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Notes for you and the Programme Builder (optional)</label>
          <textarea
            className={styles.textarea}
            style={{ minHeight: 60 }}
            value={d.notes}
            placeholder="For example, who this phase is for and what has to be true before moving on."
            onChange={(e) => set({ notes: e.target.value })}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Blocks in this phase, in order</label>
          {d.block_ids.length === 0 && <p className={styles.notice}>No blocks yet.</p>}
          {d.block_ids.map((id, i) => (
            <div key={id} className={styles.exerciseRow} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
              <span style={{ fontSize: 14 }}>
                {i + 1}. {blockById.get(id)?.name ?? "A block that has been deleted"}
              </span>
              <span style={{ display: "flex", gap: 6 }}>
                <button type="button" className={styles.iconButton} onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                  &uarr;
                </button>
                <button type="button" className={styles.iconButton} onClick={() => move(i, 1)} disabled={i === d.block_ids.length - 1} aria-label="Move down">
                  &darr;
                </button>
                <button type="button" className={styles.iconButtonDanger} onClick={() => set({ block_ids: d.block_ids.filter((b) => b !== id) })} aria-label="Remove">
                  &times;
                </button>
              </span>
            </div>
          ))}
          {available.length > 0 && (
            <select
              className={styles.input}
              style={{ marginTop: 8 }}
              value=""
              onChange={(e) => e.target.value && set({ block_ids: [...d.block_ids, e.target.value] })}
            >
              <option value="">+ Add a block</option>
              {available.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
        </div>
        {error && <div className={styles.error}>{error}</div>}
        <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={save} disabled={saving || !d.name.trim()}>
            {saving ? "Saving…" : "Save phase set"}
          </button>
          <button type="button" className={styles.buttonSecondary} onClick={() => setEditing(null)} disabled={saving}>
            Cancel
          </button>
          {d.id && (
            <button type="button" className={styles.buttonDestructive} onClick={remove} disabled={saving}>
              Delete
            </button>
          )}
        </div>
      </div>
    );
  }

  const openBlock = (b: LibraryCircuitBlock) =>
    setEditing({ kind: "block", draft: { id: b.id, name: b.name, notes: b.notes, exercises: b.exercises.map((e) => ({ ...e })) } });
  const openSet = (s: LibraryCircuitSet) => setEditing({ kind: "set", draft: { id: s.id, name: s.name, notes: s.notes, block_ids: [...s.block_ids] } });

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
        <h2 className={styles.cardTitle} style={{ margin: 0 }}>
          Circuit blocks
        </h2>
        <button type="button" className={styles.buttonSecondary} onClick={() => setEditing({ kind: "block", draft: emptyBlock() })}>
          + New circuit block
        </button>
      </div>
      {library.blocks.length === 0 && <p className={styles.notice}>No circuit blocks yet.</p>}
      {library.blocks.map((b) => (
        <button
          key={b.id}
          type="button"
          className={styles.card}
          onClick={() => openBlock(b)}
          style={{ display: "block", width: "100%", textAlign: "left", padding: "14px 18px", borderLeft: "4px solid var(--accent-cardio, #9B1C1C)", cursor: "pointer" }}
        >
          <div style={{ fontSize: 16, fontWeight: 600 }}>{b.name}</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4, lineHeight: 1.5 }}>
            Run, then{" "}
            {b.exercises.length ? b.exercises.map((e) => `${e.name} ${doseText(e)}`).join(", ") : "no exercises yet"}, then walk
          </div>
        </button>
      ))}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 28 }}>
        <h2 className={styles.cardTitle} style={{ margin: 0 }}>
          Phase sets
        </h2>
        <button type="button" className={styles.buttonSecondary} onClick={() => setEditing({ kind: "set", draft: emptySet() })} disabled={library.blocks.length === 0}>
          + New phase set
        </button>
      </div>
      {library.sets.length === 0 && <p className={styles.notice}>No phase sets yet. Make a few blocks first, then group them into a phase.</p>}
      {library.sets.map((s) => (
        <button
          key={s.id}
          type="button"
          className={styles.card}
          onClick={() => openSet(s)}
          style={{ display: "block", width: "100%", textAlign: "left", padding: "14px 18px", cursor: "pointer" }}
        >
          <div style={{ fontSize: 16, fontWeight: 600 }}>{s.name}</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
            {s.block_ids.length ? s.block_ids.map((id) => blockById.get(id)?.name).filter(Boolean).join(", ") : "No blocks yet"}
          </div>
        </button>
      ))}
    </>
  );
}
