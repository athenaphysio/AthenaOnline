"use client";

import { useState } from "react";
import WeekGrid from "./WeekGrid";
import WeekTabs from "./WeekTabs";
import {
  newEditorItem,
  moveEditorItem,
  removeEditorItem,
  updateWeekField,
  changeWeekExercise,
  updateNumericField,
  type EditorItem,
  type LibraryExerciseOption,
} from "@/lib/blockItemsEditor";
import styles from "./BlockGroupEditor.module.css";

export type BlockDetail = {
  id: string;
  name: string;
  type: string;
  block_length_weeks: number;
  items: EditorItem[];
  // Optional -- only the Workout builder's live preview needs this (for the
  // sequence-type badge); every other caller that constructs a BlockDetail
  // by hand (duplicate/new workout pages, the Programme Builder's inline
  // editor) doesn't carry it and doesn't need to.
  sequence_type?: string;
};

type Props = {
  block: BlockDetail;
  exerciseLibrary: LibraryExerciseOption[];
  onChange: (items: EditorItem[]) => void;
};

// A shared Block's own exercises, expanded inline wherever that block is
// referenced (the standalone Block Builder embeds this via BlockBuilder.tsx
// directly editing its own items; this component is for every other place
// a block shows up, starting with a block-item inside a Workout). Editing
// here changes the block itself -- the same as editing it in the Block
// Builder -- so the note below is a courtesy, not a warning.
export default function BlockGroupEditor({ block, exerciseLibrary, onChange }: Props) {
  const [addingExerciseId, setAddingExerciseId] = useState("");
  const [selectedWeek, setSelectedWeek] = useState(1);

  function addExercise() {
    const exercise = exerciseLibrary.find((e) => e.exercise_id === addingExerciseId);
    if (!exercise) return;
    onChange([...block.items, newEditorItem(exercise, block.block_length_weeks)]);
    setAddingExerciseId("");
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.blockName}>{block.name}</span>
        <span className={styles.blockTag}>Shared block — changes apply everywhere it&apos;s used</span>
      </div>

      {block.items.length === 0 && <div className={styles.empty}>No exercises in this block yet.</div>}

      {block.items.length > 0 && (
        <WeekTabs
          weekNumbers={Array.from({ length: block.block_length_weeks }, (_, i) => i + 1)}
          selectedWeek={Math.min(selectedWeek, block.block_length_weeks)}
          onSelectWeek={setSelectedWeek}
        />
      )}

      {block.items.map((item, index) => (
        <div key={item.key} className={styles.itemRow}>
          <div className={styles.itemHeader}>
            <span className={styles.itemName}>{item.weeks[0]?.name ?? "Exercise"}</span>
            <div className={styles.itemControls}>
              <button
                type="button"
                onClick={() => onChange(moveEditorItem(block.items, index, -1))}
                disabled={index === 0}
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => onChange(moveEditorItem(block.items, index, 1))}
                disabled={index === block.items.length - 1}
                aria-label="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => onChange(removeEditorItem(block.items, index))}
                aria-label="Remove"
              >
                🗑
              </button>
            </div>
          </div>
          {(() => {
            const week = item.weeks.find((w) => w.week_number === Math.min(selectedWeek, block.block_length_weeks));
            if (!week) return null;
            return (
              <WeekGrid
                week={week}
                exerciseLibrary={exerciseLibrary}
                onChangeExercise={(weekNumber, exerciseId) =>
                  onChange(changeWeekExercise(block.items, item.key, weekNumber, exerciseId, exerciseLibrary))
                }
                onChangeField={(weekNumber, patch) =>
                  onChange(updateWeekField(block.items, item.key, weekNumber, patch))
                }
                onChangeNumeric={(weekNumber, field, value) =>
                  onChange(updateNumericField(block.items, item.key, weekNumber, field, value))
                }
              />
            );
          })()}
        </div>
      ))}

      <div className={styles.addRow}>
        <select
          className={styles.addSelect}
          value={addingExerciseId}
          onChange={(e) => setAddingExerciseId(e.target.value)}
        >
          <option value="">Add an exercise to this block…</option>
          {exerciseLibrary.map((e) => (
            <option key={e.exercise_id} value={e.exercise_id}>
              {e.name_clinical}
            </option>
          ))}
        </select>
        <button type="button" className={styles.addButton} disabled={!addingExerciseId} onClick={addExercise}>
          + Add
        </button>
      </div>
    </div>
  );
}
