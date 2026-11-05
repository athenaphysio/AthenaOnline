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
  /** An Open programme is a flat list with no week-by-week progression --
   * every exercise just has the one prescription, so the week tabs (and
   * the choice they imply) don't apply. Always reads/writes week 1 in
   * that case, whatever the block's own block_length_weeks happens to be. */
  singleWeek?: boolean;
  /** Whether the latest change has reached the Blocks library. */
  saveState?: "saving" | "saved" | "error";
};

// A shared Block's own exercises, expanded inline wherever that block is
// referenced (the standalone Block Builder embeds this via BlockBuilder.tsx
// directly editing its own items; this component is for every other place
// a block shows up, starting with a block-item inside a Workout). Editing
// here changes the block itself -- the same as editing it in the Block
// Builder -- so the note below is a courtesy, not a warning.
export default function BlockGroupEditor({ block, exerciseLibrary, onChange, singleWeek = false, saveState }: Props) {
  const [search, setSearch] = useState("");
  const [selectedWeek, setSelectedWeek] = useState(1);
  const activeWeek = singleWeek ? 1 : Math.min(selectedWeek, block.block_length_weeks);

  // Type a few letters to narrow the library; every word typed must appear
  // in the exercise's name or body area, in any order.
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const matches =
    words.length === 0
      ? []
      : exerciseLibrary
          .filter((e) => {
            const hay = `${e.name_clinical} ${e.body_site ?? ""}`.toLowerCase();
            return words.every((w) => hay.includes(w));
          })
          .slice(0, 12);

  function addExercise(exerciseId: string) {
    const exercise = exerciseLibrary.find((e) => e.exercise_id === exerciseId);
    if (!exercise) return;
    onChange([...block.items, newEditorItem(exercise, block.block_length_weeks)]);
    setSearch("");
  }

  return (
    <div className={styles.wrapper}>
      {/* block.name itself is deliberately not repeated here -- it's
          already shown once, in the coloured header bar directly above
          this component (see WorkoutBuilder.tsx's previewCardHeader),
          so this caption sits directly under that as a subtitle rather
          than under a second copy of the title. */}
      <div className={styles.header}>
        <span className={styles.blockTag}>
          {saveState === "saving"
            ? "Saving to your Blocks library…"
            : saveState === "saved"
              ? "Saved to your Blocks library, and used everywhere this block appears"
              : saveState === "error"
                ? "Could not save to your Blocks library; press Save to try again"
                : "Shared block from your Blocks library: changes save there and apply everywhere it is used"}
        </span>
      </div>

      {block.items.length === 0 && <div className={styles.empty}>No exercises in this block yet.</div>}

      {block.items.length > 0 && !singleWeek && (
        <WeekTabs
          weekNumbers={Array.from({ length: block.block_length_weeks }, (_, i) => i + 1)}
          selectedWeek={activeWeek}
          onSelectWeek={setSelectedWeek}
        />
      )}

      {block.items.map((item, index) => (
        <div key={item.key} className={styles.itemRow}>
          {/* One level down from the block's own teal header -- crimson
              here rather than teal is the whole point: the colour itself
              says "this is an exercise", not "this is a block". Move/
              Remove live here as icon buttons rather than their own row,
              since the name in this bar already identifies the exercise --
              swapping it for a different one is remove-then-add-from-
              library, not an in-place dropdown. */}
          <div className={styles.itemHeader}>
            <span className={styles.itemName}>{item.weeks[0]?.name ?? "Exercise"}</span>
            <div className={styles.itemHeaderControls}>
              <button
                type="button"
                className={styles.itemIconButton}
                title="Move up"
                aria-label="Move up"
                onClick={() => onChange(moveEditorItem(block.items, index, -1))}
                disabled={index === 0}
              >
                ↑
              </button>
              <button
                type="button"
                className={styles.itemIconButton}
                title="Move down"
                aria-label="Move down"
                onClick={() => onChange(moveEditorItem(block.items, index, 1))}
                disabled={index === block.items.length - 1}
              >
                ↓
              </button>
              <button
                type="button"
                className={styles.itemIconButton}
                title="Remove"
                aria-label="Remove"
                onClick={() => onChange(removeEditorItem(block.items, index))}
              >
                ✕
              </button>
            </div>
          </div>
          <div className={styles.itemBody}>
            {(() => {
              const week = item.weeks.find((w) => w.week_number === activeWeek);
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
                  compact
                />
              );
            })()}
          </div>
        </div>
      ))}

      <div className={styles.addSearch}>
        <input
          type="search"
          className={styles.addSelect}
          placeholder="Search to add an exercise to this block…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search exercises to add to this block"
        />
        {words.length > 0 && (
          <div className={styles.addResults} role="listbox">
            {matches.length === 0 ? (
              <div className={styles.addEmpty}>No exercises match &ldquo;{search}&rdquo;.</div>
            ) : (
              matches.map((e) => (
                <button key={e.exercise_id} type="button" className={styles.addResult} onClick={() => addExercise(e.exercise_id)}>
                  <span>{e.name_clinical}</span>
                  {e.body_site && <span className={styles.addResultMeta}>{e.body_site}</span>}
                  <span className={styles.addResultPlus}>+ Add</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
