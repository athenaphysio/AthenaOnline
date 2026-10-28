import Link from "next/link";
import styles from "./PassportTabBar.module.css";

// The bottom bar, shown only to clients whose Human Passport David has
// switched on. Two tabs for the pilot; My Programme and Me can join as
// separate tabs once those screens exist in their own right.
export default function PassportTabBar({ active }: { active: "today" | "passport" }) {
  return (
    <>
      <div className={styles.spacer} aria-hidden="true" />
      <nav className={styles.bar} aria-label="Main">
        <Link href="/session" className={`${styles.tab} ${active === "today" ? styles.active : ""}`} aria-current={active === "today" ? "page" : undefined}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
          <span>My Programme</span>
        </Link>
        <Link href="/session/passport" className={`${styles.tab} ${active === "passport" ? styles.active : ""}`} aria-current={active === "passport" ? "page" : undefined}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <rect x="5" y="3.5" width="14" height="17" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M8.5 15.5l2.5-3 2 2 2.5-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>My Passport</span>
        </Link>
      </nav>
    </>
  );
}
