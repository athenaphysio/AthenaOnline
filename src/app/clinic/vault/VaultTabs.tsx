import Link from "next/link";
import styles from "./VaultLibrary.module.css";

export type VaultTab = "exercises" | "blocks" | "sessions" | "programmes";

// Programmes isn't built yet -- left as a plain, unclickable label rather
// than a link to a page that doesn't exist, same as Sessions and Blocks
// themselves were before each was built.
export default function VaultTabs({ active }: { active: VaultTab }) {
  return (
    <div className={styles.tabs}>
      <Link href="/clinic/vault" className={`${styles.tab} ${active === "exercises" ? styles.tabActive : ""}`}>
        Exercises
      </Link>
      <Link href="/clinic/vault/blocks" className={`${styles.tab} ${active === "blocks" ? styles.tabActive : ""}`}>
        Blocks
      </Link>
      <Link href="/clinic/vault/sessions" className={`${styles.tab} ${active === "sessions" ? styles.tabActive : ""}`}>
        Sessions
      </Link>
      <span className={styles.tab}>Programmes</span>
    </div>
  );
}
