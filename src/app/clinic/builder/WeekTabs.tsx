"use client";

import styles from "./WeekTabs.module.css";

type Props = {
  weekNumbers: number[];
  selectedWeek: number;
  onSelectWeek: (week: number) => void;
};

// One row of week tabs governs every exercise's card at once -- switching
// to "Week 3" shows week 3 for the whole block, not just one exercise. This
// replaces scrolling sideways through every week for every exercise.
export default function WeekTabs({ weekNumbers, selectedWeek, onSelectWeek }: Props) {
  return (
    <div className={styles.row}>
      {weekNumbers.map((n) => (
        <button
          key={n}
          type="button"
          className={`${styles.tab} ${selectedWeek === n ? styles.tabActive : ""}`}
          onClick={() => onSelectWeek(n)}
        >
          Week {n}
        </button>
      ))}
    </div>
  );
}
