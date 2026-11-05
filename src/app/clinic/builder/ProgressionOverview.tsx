"use client";

import { summariseWeek, weekChanged, type EditorItem } from "@/lib/blockItemsEditor";
import styles from "./ProgressionOverview.module.css";

type Props = {
  items: EditorItem[];
  blockLengthWeeks: number;
  selectedWeek: number;
  /** Opens one exercise in one week for editing. */
  onSelectCell: (weekNumber: number, itemKey: string) => void;
  /** Copies the selected week's settings onto every later week. */
  onCopyForward: (fromWeek: number) => void;
};

// The whole block's week to week progression on one screen: exercises down
// the side, weeks across the top, each box showing that week's numbers.
// Boxes that differ from the week before are marked, so the progression is
// visible at a glance instead of hidden behind each exercise's own card.
// Tapping a box jumps straight to editing that exercise in that week.
export default function ProgressionOverview({
  items,
  blockLengthWeeks,
  selectedWeek,
  onSelectCell,
  onCopyForward,
}: Props) {
  if (items.length === 0 || blockLengthWeeks < 2) return null;
  const weekNumbers = Array.from({ length: blockLengthWeeks }, (_, i) => i + 1);
  const canCopy = selectedWeek < blockLengthWeeks;
  const laterWeeks =
    selectedWeek + 1 === blockLengthWeeks
      ? `Week ${blockLengthWeeks}`
      : `Weeks ${selectedWeek + 1} to ${blockLengthWeeks}`;

  function handleCopy() {
    const ok = window.confirm(
      `Copy every exercise's Week ${selectedWeek} settings onto ${laterWeeks}? Anything already set in ${laterWeeks} will be replaced.`
    );
    if (ok) onCopyForward(selectedWeek);
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.titleRow}>
        <div className={styles.title}>Progression across the block</div>
        <div className={styles.hint}>Tap any box to edit it. Marked boxes have changed from the week before.</div>
      </div>
      <div className={styles.scroller}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.exerciseHead}>Exercise</th>
              {weekNumbers.map((n) => (
                <th key={n} className={n === selectedWeek ? styles.weekHeadActive : styles.weekHead}>
                  Week {n}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const first = item.weeks[0];
              return (
                <tr key={item.key}>
                  <td className={styles.exerciseCell}>{first?.name ?? "Exercise"}</td>
                  {weekNumbers.map((n) => {
                    const w = item.weeks.find((x) => x.week_number === n);
                    const prev = item.weeks.find((x) => x.week_number === n - 1);
                    const changed = weekChanged(prev, w);
                    const swapped = w && first && w.exercise_id !== first.exercise_id;
                    const summary = summariseWeek(w) || "Not set";
                    return (
                      <td key={n} className={n === selectedWeek ? styles.cellActiveCol : undefined}>
                        <button
                          type="button"
                          className={`${styles.cell} ${changed ? styles.cellChanged : ""}`}
                          onClick={() => onSelectCell(n, item.key)}
                          title={changed ? `Changed from Week ${n - 1}` : `Edit Week ${n}`}
                        >
                          <span className={styles.cellValue}>{summary}</span>
                          {swapped && <span className={styles.cellSwap}>{w?.name}</span>}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {canCopy && (
        <button type="button" className={styles.copyButton} onClick={handleCopy}>
          Copy Week {selectedWeek} to {laterWeeks}
        </button>
      )}
    </div>
  );
}
