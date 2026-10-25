"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clinicStyles from "../../clinic.module.css";
import { useUnsavedChanges } from "../../useUnsavedChanges";
import {
  BODY_AREA_LABELS,
  CATEGORY_LABELS,
  SIDES,
  STATUS_LABELS,
  flowSeconds,
  formatDuration,
  type Flow,
  type FlowBodyArea,
  type FlowCategory,
  type FlowMove,
  type FlowSide,
  type FlowStatus,
} from "@/lib/flows";
import flowStyles from "./Flows.module.css";

export type ExerciseOption = { id: string; name: string };

type Props = {
  mode: "create" | "edit";
  initial: Flow;
  exercises: ExerciseOption[];
};

const BLANK_MOVE: FlowMove = { name: "", seconds: 30, breathSeconds: 6, side: "", cue: "", exerciseId: null };

export default function FlowEditor({ mode, initial, exercises }: Props) {
  const router = useRouter();
  const [flow, setFlow] = useState<Flow>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedOnce, setSavedOnce] = useState(mode === "edit");
  const { hasChanges, markSaved } = useUnsavedChanges(flow);

  function set<K extends keyof Flow>(key: K, value: Flow[K]) {
    setFlow((f) => ({ ...f, [key]: value }));
  }

  function setMove(i: number, patch: Partial<FlowMove>) {
    setFlow((f) => ({ ...f, moves: f.moves.map((m, j) => (j === i ? { ...m, ...patch } : m)) }));
  }

  function moveBy(i: number, delta: number) {
    setFlow((f) => {
      const moves = [...f.moves];
      const j = i + delta;
      if (j < 0 || j >= moves.length) return f;
      [moves[i], moves[j]] = [moves[j], moves[i]];
      return { ...f, moves };
    });
  }

  function duplicate(i: number) {
    setFlow((f) => {
      const moves = [...f.moves];
      const copy = { ...moves[i] };
      if (copy.side === "Left") copy.side = "Right";
      else if (copy.side === "Right") copy.side = "Left";
      moves.splice(i + 1, 0, copy);
      return { ...f, moves };
    });
  }

  function remove(i: number) {
    setFlow((f) => ({ ...f, moves: f.moves.filter((_, j) => j !== i) }));
  }

  async function save(): Promise<boolean> {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clinic/vault/flows/${flow.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(flow),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed.");
      markSaved(flow);
      setSavedOnce(true);
      if (mode === "create") router.push(`/clinic/vault/flows/${flow.id}`);
      else router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function openPrompter() {
    // The prompter reads the saved flow, so save first if anything changed.
    if (hasChanges || !savedOnce) {
      const ok = await save();
      if (!ok) return;
    }
    router.push(`/clinic/vault/flows/${flow.id}/prompter`);
  }

  async function deleteFlow() {
    if (!window.confirm(`Delete "${flow.title || "this flow"}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/clinic/vault/flows/${flow.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Delete failed.");
      return;
    }
    markSaved(flow);
    router.push("/clinic/vault/flows");
  }

  const total = flowSeconds(flow.moves);

  return (
    <div className={clinicStyles.card}>
      <div className={flowStyles.editorHead}>
        <span className={clinicStyles.notice} style={{ marginTop: 0 }}>
          {hasChanges ? "Unsaved changes" : savedOnce ? "All changes saved" : "Not saved yet"}
        </span>
        <div className={flowStyles.headActions}>
          <button type="button" className={flowStyles.linkButton} onClick={openPrompter} disabled={flow.moves.length === 0}>
            Open filming prompter
          </button>
        </div>
      </div>

      <div className={clinicStyles.field}>
        <label className={clinicStyles.label}>Title</label>
        <input className={clinicStyles.input} value={flow.title} onChange={(e) => set("title", e.target.value)} />
      </div>

      <div className={flowStyles.row3}>
        <div className={clinicStyles.field}>
          <label className={clinicStyles.label}>Type of flow</label>
          <select className={clinicStyles.input} value={flow.category} onChange={(e) => set("category", e.target.value as FlowCategory)}>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className={clinicStyles.field}>
          <label className={clinicStyles.label}>Body area</label>
          <select className={clinicStyles.input} value={flow.bodyArea} onChange={(e) => set("bodyArea", e.target.value as FlowBodyArea)}>
            {Object.entries(BODY_AREA_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className={clinicStyles.field}>
          <label className={clinicStyles.label}>Status</label>
          <select className={clinicStyles.input} value={flow.status} onChange={(e) => set("status", e.target.value as FlowStatus)}>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={clinicStyles.row2}>
        <div className={clinicStyles.field}>
          <label className={clinicStyles.label}>Entry point (where and when it is done)</label>
          <input
            className={clinicStyles.input}
            value={flow.entryPoint}
            placeholder="For example, seated at a desk"
            onChange={(e) => set("entryPoint", e.target.value)}
          />
        </div>
        <div className={clinicStyles.field}>
          <label className={clinicStyles.label}>Follow along video link (Vimeo)</label>
          <input
            className={clinicStyles.input}
            value={flow.vimeoUrl}
            placeholder="https://vimeo.com/…"
            onChange={(e) => set("vimeoUrl", e.target.value)}
          />
        </div>
      </div>

      <div className={clinicStyles.field}>
        <label className={clinicStyles.label}>What this flow is for (client facing)</label>
        <textarea className={clinicStyles.textarea} style={{ minHeight: 70 }} value={flow.summary} onChange={(e) => set("summary", e.target.value)} />
      </div>

      <div className={clinicStyles.field}>
        <label className={clinicStyles.label}>Private notes</label>
        <textarea className={clinicStyles.textarea} style={{ minHeight: 60 }} value={flow.notes} onChange={(e) => set("notes", e.target.value)} />
      </div>

      <div className={flowStyles.movesHead}>
        <h4>Moves</h4>
        <span className={flowStyles.total}>
          {flow.moves.length} moves, {formatDuration(total)} in total
        </span>
      </div>

      {flow.moves.map((m, i) => (
        <div key={i} className={flowStyles.move}>
          <div className={flowStyles.moveNumber}>{i + 1}</div>
          <div className={flowStyles.moveFields}>
            <div className={flowStyles.moveTop}>
              <div className={flowStyles.smallField}>
                <label>Move name</label>
                <input value={m.name} onChange={(e) => setMove(i, { name: e.target.value })} />
              </div>
              <div className={flowStyles.smallField}>
                <label>Seconds</label>
                <input
                  type="number"
                  min={1}
                  value={m.seconds}
                  onChange={(e) => setMove(i, { seconds: parseInt(e.target.value, 10) || 0 })}
                />
              </div>
              <div className={flowStyles.smallField}>
                <label>Breath cycle (s)</label>
                <input
                  type="number"
                  min={0}
                  value={m.breathSeconds}
                  onChange={(e) => setMove(i, { breathSeconds: parseInt(e.target.value, 10) || 0 })}
                />
              </div>
              <div className={flowStyles.smallField}>
                <label>Side</label>
                <select value={m.side} onChange={(e) => setMove(i, { side: e.target.value as FlowSide })}>
                  {SIDES.map((s) => (
                    <option key={s} value={s}>
                      {s || "None"}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className={flowStyles.smallField}>
              <label>Cue shown on the prompter</label>
              <textarea value={m.cue} onChange={(e) => setMove(i, { cue: e.target.value })} />
            </div>
            <div className={flowStyles.smallField}>
              <label>Built from exercise (optional)</label>
              <select value={m.exerciseId ?? ""} onChange={(e) => setMove(i, { exerciseId: e.target.value || null })}>
                <option value="">None</option>
                {exercises.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.id} {ex.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className={flowStyles.moveTools}>
            <button type="button" className={flowStyles.toolButton} title="Move up" disabled={i === 0} onClick={() => moveBy(i, -1)}>
              ↑
            </button>
            <button
              type="button"
              className={flowStyles.toolButton}
              title="Move down"
              disabled={i === flow.moves.length - 1}
              onClick={() => moveBy(i, 1)}
            >
              ↓
            </button>
            <button type="button" className={flowStyles.toolButton} title="Copy this move (swaps left and right)" onClick={() => duplicate(i)}>
              ⧉
            </button>
            <button type="button" className={flowStyles.toolButton} title="Remove this move" onClick={() => remove(i)}>
              ×
            </button>
          </div>
        </div>
      ))}

      <button type="button" className={flowStyles.addMove} onClick={() => set("moves", [...flow.moves, { ...BLANK_MOVE }])}>
        + Add a move
      </button>

      {error && (
        <div className={clinicStyles.error} style={{ marginTop: 16 }}>
          {error}
        </div>
      )}

      <div className={flowStyles.footer}>
        <button type="button" className={clinicStyles.button} disabled={saving || !flow.title.trim()} onClick={save}>
          {saving ? "Saving…" : "Save flow"}
        </button>
        {mode === "edit" && (
          <button type="button" className={clinicStyles.buttonDestructive} onClick={deleteFlow}>
            Delete flow
          </button>
        )}
      </div>
    </div>
  );
}
