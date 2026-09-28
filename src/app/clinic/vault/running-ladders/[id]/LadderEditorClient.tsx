"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clinicStyles from "../../../clinic.module.css";
import styles from "./RunningLadderEditor.module.css";

export type LadderDetail = {
  id: string;
  name: string;
  phase_label: string | null;
  description: string | null;
  active: boolean;
};

export type RungDetail = {
  key: string;
  repeats: number | null;
  run_portion: string | null;
  recovery: string | null;
  target_pace: string | null;
  effort_cue: string | null;
  total_running_minutes: string | null;
  notes: string | null;
};

const BLANK_RUNG: Omit<RungDetail, "key"> = {
  repeats: null,
  run_portion: null,
  recovery: null,
  target_pace: null,
  effort_cue: null,
  total_running_minutes: null,
  notes: null,
};

let keyCounter = 0;
function newKey(): string {
  keyCounter += 1;
  return `new-${Date.now()}-${keyCounter}`;
}

function RungRow({
  rung,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}: {
  rung: RungDetail;
  index: number;
  total: number;
  onChange: (patch: Partial<RungDetail>) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className={styles.rungRow}>
      <div className={styles.rungHeader}>
        <span className={styles.rungNumber}>Rung {index + 1}</span>
        <div className={styles.rungControls}>
          <button
            type="button"
            className={styles.rungIconButton}
            title="Move up"
            aria-label="Move up"
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            ↑
          </button>
          <button
            type="button"
            className={styles.rungIconButton}
            title="Move down"
            aria-label="Move down"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            ↓
          </button>
          <button type="button" className={styles.rungIconButton} title="Remove" aria-label="Remove" onClick={onRemove}>
            ✕
          </button>
        </div>
      </div>

      <div className={clinicStyles.row2}>
        <div className={clinicStyles.field}>
          <label className={clinicStyles.label}>Repeats</label>
          <input
            type="number"
            className={clinicStyles.input}
            value={rung.repeats ?? ""}
            onChange={(e) => onChange({ repeats: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </div>
        <div className={clinicStyles.field}>
          <label className={clinicStyles.label}>Run portion</label>
          <input
            className={clinicStyles.input}
            placeholder="e.g. 2 min run"
            value={rung.run_portion ?? ""}
            onChange={(e) => onChange({ run_portion: e.target.value || null })}
          />
        </div>
      </div>

      <div className={clinicStyles.row2}>
        <div className={clinicStyles.field}>
          <label className={clinicStyles.label}>Recovery</label>
          <input
            className={clinicStyles.input}
            placeholder="e.g. 2.5 min walk"
            value={rung.recovery ?? ""}
            onChange={(e) => onChange({ recovery: e.target.value || null })}
          />
        </div>
        <div className={clinicStyles.field}>
          <label className={clinicStyles.label}>Total running</label>
          <input
            className={clinicStyles.input}
            placeholder="e.g. 8 min"
            value={rung.total_running_minutes ?? ""}
            onChange={(e) => onChange({ total_running_minutes: e.target.value || null })}
          />
        </div>
      </div>

      <div className={clinicStyles.row2}>
        <div className={clinicStyles.field}>
          <label className={clinicStyles.label}>Target pace</label>
          <input
            className={clinicStyles.input}
            placeholder="e.g. 4:45 to 5:00 /km"
            value={rung.target_pace ?? ""}
            onChange={(e) => onChange({ target_pace: e.target.value || null })}
          />
        </div>
        <div className={clinicStyles.field}>
          <label className={clinicStyles.label}>Effort cue</label>
          <input
            className={clinicStyles.input}
            placeholder="e.g. Crisp and controlled"
            value={rung.effort_cue ?? ""}
            onChange={(e) => onChange({ effort_cue: e.target.value || null })}
          />
        </div>
      </div>

      <div className={clinicStyles.field}>
        <label className={clinicStyles.label}>Notes (optional)</label>
        <textarea
          className={clinicStyles.textarea}
          value={rung.notes ?? ""}
          onChange={(e) => onChange({ notes: e.target.value || null })}
        />
      </div>
    </div>
  );
}

// The whole ladder -- its own name/phase/active flag, plus every rung on
// it, edited and reordered locally and saved in one call (same "resubmit
// the whole ordered list" pattern the block builder uses for its own
// items, not a per-rung reorder endpoint).
export default function LadderEditorClient({ ladder, initialRungs }: { ladder: LadderDetail; initialRungs: RungDetail[] }) {
  const router = useRouter();
  const [name, setName] = useState(ladder.name);
  const [phaseLabel, setPhaseLabel] = useState(ladder.phase_label ?? "");
  const [description, setDescription] = useState(ladder.description ?? "");
  const [active, setActive] = useState(ladder.active);
  const [rungs, setRungs] = useState<RungDetail[]>(initialRungs);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addRung() {
    setRungs((prev) => [...prev, { key: newKey(), ...BLANK_RUNG }]);
    setSaved(false);
  }

  function moveRung(index: number, direction: -1 | 1) {
    setRungs((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSaved(false);
  }

  function removeRung(index: number) {
    setRungs((prev) => prev.filter((_, i) => i !== index));
    setSaved(false);
  }

  function updateRung(key: string, patch: Partial<RungDetail>) {
    setRungs((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setSaved(false);
  }

  async function save() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clinic/vault/running-ladders/${ladder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phase_label: phaseLabel.trim() || null,
          description: description.trim() || null,
          active,
          rungs: rungs.map((r) => ({
            repeats: r.repeats,
            run_portion: r.run_portion,
            recovery: r.recovery,
            target_pace: r.target_pace,
            effort_cue: r.effort_cue,
            total_running_minutes: r.total_running_minutes,
            notes: r.notes,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Link href="/clinic/vault/running-ladders" className={styles.backLink}>
        &larr; Back to running ladders
      </Link>

      <div className={styles.headerRow}>
        <h3>Edit ladder</h3>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--graphite)" }}>
          <input type="checkbox" checked={active} onChange={(e) => { setActive(e.target.checked); setSaved(false); }} />
          Active
        </label>
      </div>

      <div className={clinicStyles.row2}>
        <div className={clinicStyles.field}>
          <label className={clinicStyles.label}>Name</label>
          <input className={clinicStyles.input} value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} />
        </div>
        <div className={clinicStyles.field}>
          <label className={clinicStyles.label}>Phase label</label>
          <input
            className={clinicStyles.input}
            placeholder="e.g. Phases 1 and 2"
            value={phaseLabel}
            onChange={(e) => { setPhaseLabel(e.target.value); setSaved(false); }}
          />
        </div>
      </div>

      <div className={clinicStyles.field}>
        <label className={clinicStyles.label}>Description (optional)</label>
        <textarea
          className={clinicStyles.textarea}
          value={description}
          onChange={(e) => { setDescription(e.target.value); setSaved(false); }}
        />
      </div>

      <h3 style={{ marginTop: 24, marginBottom: 12 }}>Rungs</h3>

      {rungs.length === 0 && <p className={clinicStyles.notice}>No rungs yet. Add the first one below.</p>}

      {rungs.map((rung, index) => (
        <RungRow
          key={rung.key}
          rung={rung}
          index={index}
          total={rungs.length}
          onChange={(patch) => updateRung(rung.key, patch)}
          onMove={(direction) => moveRung(index, direction)}
          onRemove={() => removeRung(index)}
        />
      ))}

      <div className={styles.addRungRow}>
        <button type="button" className={clinicStyles.buttonSecondary} style={{ width: "auto", padding: "0 20px" }} onClick={addRung}>
          + Add rung
        </button>
      </div>

      {error && <div className={clinicStyles.error}>{error}</div>}

      <div className={styles.saveRow}>
        <button
          type="button"
          className={clinicStyles.button}
          style={{ width: "auto", padding: "0 24px" }}
          onClick={save}
          disabled={saving}
        >
          {saving ? "Saving…" : saved ? "Save changes" : "Save ladder"}
        </button>
      </div>
    </div>
  );
}
