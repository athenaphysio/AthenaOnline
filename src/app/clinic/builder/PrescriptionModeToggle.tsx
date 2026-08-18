"use client";

import { PRESCRIPTION_MODES, type PrescriptionMode } from "@/lib/prescriptionMode";
import styles from "./PrescriptionModeToggle.module.css";

type Props = {
  value: PrescriptionMode;
  onChange: (mode: PrescriptionMode) => void;
};

// Reps & Sets vs Time under load -- the same two buttons wherever a drill's
// prescription is edited (the block week editor, a standalone exercise
// dropped into a workout, Quick Assign), so switching mode looks and
// behaves the same everywhere David encounters it.
export default function PrescriptionModeToggle({ value, onChange }: Props) {
  return (
    <div className={styles.row}>
      {PRESCRIPTION_MODES.map((m) => (
        <button
          key={m.value}
          type="button"
          className={`${styles.button} ${value === m.value ? styles.buttonActive : ""}`}
          onClick={() => onChange(m.value)}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
