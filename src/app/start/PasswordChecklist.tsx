"use client";

import { PASSWORD_INTRO, PASSWORD_RULES } from "@/lib/passwordRules";
import styles from "./start.module.css";

// Shown under a new password box. Each requirement is ticked as it is met,
// and an unmet one stays quiet rather than turning red, so it reads as a
// guide while typing, not a telling off.
export default function PasswordChecklist({ password, id }: { password: string; id: string }) {
  return (
    <div id={id} className={styles.pwHelp}>
      <p className={styles.pwIntro}>{PASSWORD_INTRO}</p>
      <ul className={styles.pwList} aria-live="polite">
        {PASSWORD_RULES.map((rule) => {
          const met = rule.test(password);
          return (
            <li key={rule.key} className={met ? `${styles.pwItem} ${styles.pwItemMet}` : styles.pwItem}>
              <span className={styles.pwMark} aria-hidden="true">
                {met ? "✓" : "○"}
              </span>
              {rule.label}
              <span className={styles.srOnly}>{met ? ", done" : ", still needed"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
