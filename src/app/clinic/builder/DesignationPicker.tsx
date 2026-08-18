"use client";

import { DESIGNATIONS, type Designation } from "@/lib/designations";
import styles from "./DesignationPicker.module.css";

type Props = {
  selected: Designation[];
  onChange: (next: Designation[]) => void;
};

// The same control on a block and on a workout, so a designation means the
// same thing and is set the same way wherever it appears. Toggling rather
// than a dropdown, since these are multi-select and a block is often more
// than one of them.
export default function DesignationPicker({ selected, onChange }: Props) {
  function toggle(value: Designation) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  return (
    <div>
      <div className={styles.chips}>
        {DESIGNATIONS.map((d) => (
          <button
            key={d.value}
            type="button"
            title={d.hint}
            aria-pressed={selected.includes(d.value)}
            className={`${styles.chip} ${selected.includes(d.value) ? styles.chipActive : ""}`}
            onClick={() => toggle(d.value)}
          >
            {d.label}
          </button>
        ))}
      </div>
      <p className={styles.hint}>
        How this is meant to be worked, so you can find it again by format. Pick as many as genuinely apply.
      </p>
    </div>
  );
}
