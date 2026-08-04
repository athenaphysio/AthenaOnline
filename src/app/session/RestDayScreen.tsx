import type { ReactNode } from "react";
import styles from "./TodaySession.module.css";
import SessionHeader from "./SessionHeader";

export default function RestDayScreen({ firstName, banner }: { firstName: string; banner?: ReactNode }) {
  return (
    <div className={styles.app}>
      <div className={styles.inner}>
        <SessionHeader firstName={firstName} eyebrow="Rest day" banner={banner} />
        <p style={{ padding: "0 22px", fontSize: 14, color: "var(--stone)", lineHeight: 1.55 }}>
          Nothing scheduled today. Enjoy the rest, your next session will be here when it&apos;s due.
        </p>
      </div>
    </div>
  );
}
