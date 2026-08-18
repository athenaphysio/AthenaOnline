import Link from "next/link";
import styles from "./VaultLibrary.module.css";

export type VaultTab = "exercises" | "blocks" | "sessions" | "programmes";

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
        Workouts
      </Link>
      <Link href="/clinic/vault/programmes" className={`${styles.tab} ${active === "programmes" ? styles.tabActive : ""}`}>
        Programmes
      </Link>
    </div>
  );
}
