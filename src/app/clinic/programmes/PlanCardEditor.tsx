"use client";

import type { PlanCardData } from "@/lib/planToBuilder";
import { CARD_TYPE_LABEL } from "@/lib/planToBuilder";
import type { SessionType } from "@/lib/athenaPlan";
import clinicStyles from "../clinic.module.css";
import styles from "./PlanCardEditor.module.css";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const EDITABLE_TYPES: SessionType[] = ["run", "bike", "swim", "other"];

type Props = {
  plan: PlanCardData;
  week: number;
  day: number;
  weekCount: number;
  savedToLibrary: boolean;
  onChange: (patch: Partial<PlanCardData>) => void;
  onMove: (week: number, day: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSaveToLibrary: () => void;
  onClose: () => void;
};

// One plan-code session card, every text field editable. Week and day are
// here too so a card can be moved without dragging, which matters on a phone.
export default function PlanCardEditor({
  plan,
  week,
  day,
  weekCount,
  savedToLibrary,
  onChange,
  onMove,
  onDuplicate,
  onDelete,
  onSaveToLibrary,
  onClose,
}: Props) {
  function updateStep(i: number, patch: Partial<{ label: string; detail: string }>) {
    onChange({ steps: plan.steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  }

  return (
    <div className={styles.editor}>
      <div className={styles.topRow}>
        <button type="button" className={styles.backLink} onClick={onClose}>
          ← Back to week grid
        </button>
        <div className={styles.actions}>
          <button type="button" className={styles.smallButton} onClick={onDuplicate}>
            Duplicate
          </button>
          <button type="button" className={styles.smallButton} onClick={onSaveToLibrary} disabled={savedToLibrary} title={savedToLibrary ? "Already saved to the library" : undefined}>
            {savedToLibrary ? "Saved to library" : "Save to library"}
          </button>
          <button type="button" className={styles.deleteButton} onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>

      <div className={clinicStyles.row2}>
        <div className={clinicStyles.field}>
          <label className={clinicStyles.label}>Title</label>
          <input className={clinicStyles.input} value={plan.title} onChange={(e) => onChange({ title: e.target.value })} />
        </div>
        <div className={clinicStyles.field}>
          <label className={clinicStyles.label}>Type</label>
          <select
            className={clinicStyles.input}
            value={plan.type}
            onChange={(e) => onChange({ type: e.target.value as SessionType })}
          >
            {EDITABLE_TYPES.map((t) => (
              <option key={t} value={t}>
                {CARD_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={clinicStyles.row2}>
        <div className={clinicStyles.field}>
          <label className={clinicStyles.label}>Week</label>
          <select className={clinicStyles.input} value={week} onChange={(e) => onMove(Number(e.target.value), day)}>
            {Array.from({ length: weekCount }, (_, i) => i + 1).map((w) => (
              <option key={w} value={w}>
                Week {w}
              </option>
            ))}
          </select>
        </div>
        <div className={clinicStyles.field}>
          <label className={clinicStyles.label}>Day</label>
          <select className={clinicStyles.input} value={day} onChange={(e) => onMove(week, Number(e.target.value))}>
            {DAY_LABELS.map((d, i) => (
              <option key={d} value={i + 1}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={clinicStyles.field}>
        <label className={clinicStyles.label}>Summary</label>
        <textarea
          className={clinicStyles.textarea}
          style={{ minHeight: 70 }}
          value={plan.summary}
          onChange={(e) => onChange({ summary: e.target.value })}
        />
      </div>

      <div className={clinicStyles.field}>
        <label className={clinicStyles.label}>Steps</label>
        {plan.steps.length === 0 && <p className={clinicStyles.notice}>No steps yet.</p>}
        {plan.steps.map((step, i) => (
          <div key={i} className={styles.stepRow}>
            <input
              className={clinicStyles.input}
              style={{ flex: "0 0 30%" }}
              placeholder="Label"
              value={step.label}
              onChange={(e) => updateStep(i, { label: e.target.value })}
            />
            <input
              className={clinicStyles.input}
              placeholder="Detail"
              value={step.detail}
              onChange={(e) => updateStep(i, { detail: e.target.value })}
            />
            <button
              type="button"
              className={styles.smallButton}
              aria-label="Remove step"
              onClick={() => onChange({ steps: plan.steps.filter((_, idx) => idx !== i) })}
            >
              &times;
            </button>
          </div>
        ))}
        <button
          type="button"
          className={styles.smallButton}
          onClick={() => onChange({ steps: [...plan.steps, { label: "", detail: "" }] })}
        >
          + Add step
        </button>
      </div>

      <div className={clinicStyles.row2}>
        <div className={clinicStyles.field}>
          <label className={clinicStyles.label}>Target</label>
          <input className={clinicStyles.input} value={plan.target} onChange={(e) => onChange({ target: e.target.value })} />
        </div>
        <div className={clinicStyles.field}>
          <label className={clinicStyles.label}>Total</label>
          <input className={clinicStyles.input} value={plan.total} onChange={(e) => onChange({ total: e.target.value })} />
        </div>
      </div>

      <div className={clinicStyles.field}>
        <label className={clinicStyles.label}>Notes</label>
        <textarea
          className={clinicStyles.textarea}
          style={{ minHeight: 70 }}
          value={plan.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
        />
      </div>
    </div>
  );
}
