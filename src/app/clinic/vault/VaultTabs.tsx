import Link from "next/link";
import styles from "./VaultLibrary.module.css";

export type VaultTab = "exercises" | "blocks" | "sessions" | "programmes";

// Sessions and Programmes aren't built yet -- left as plain, unclickable
// labels rather than links to a page that doesn't exist, same as before
// Blocks itself was built.
export default function VaultTabs({ active }: { active: VaultTab }) {
  return (
    <div className={styles.tabs}>
      <Link href="/clinic/vault" className={`${styles.tab} ${active === "exercises" ? styles.tabActive : ""}`}>
        Exercises
      </Link>
      <Link href="/clinic/vault/blocks" className={`${styles.tab} ${active === "blocks" ? styles.tabActive : ""}`}>
        Blocks
      </Link>
      <span className={styles.tab}>Sessions</span>
      <span className={styles.tab}>Programmes</span>
    </div>
  );
}
