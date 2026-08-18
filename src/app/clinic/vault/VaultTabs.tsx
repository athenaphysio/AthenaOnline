import Link from "next/link";
import styles from "./VaultLibrary.module.css";

export type VaultTab =
  | "exercises"
  | "blocks"
  | "workouts"
  | "programmes"
  | "cardio-programmes"
  | "friends"
  | "equipment"
  | "phase-tags"
  | "email-templates";

type TabDef = { key: VaultTab; href: string; label: string };

// Split into content David makes, and the settings that shape how it is
// described and delivered. Friends sits in Content because it is something
// clients actually read; email templates sit in Settings because they are
// how the app writes, not something built into a programme.
//
// One flat strip of nine would be the old Content hub's tile grid coming
// back by another name; grouping keeps the content types the fast path and
// pushes the settings out of their way without hiding them.
const CONTENT_TABS: TabDef[] = [
  { key: "exercises", href: "/clinic/vault", label: "Exercises" },
  { key: "blocks", href: "/clinic/vault/blocks", label: "Blocks" },
  { key: "workouts", href: "/clinic/vault/sessions", label: "Workouts" },
  { key: "programmes", href: "/clinic/vault/programmes", label: "Programmes" },
  { key: "cardio-programmes", href: "/clinic/vault/cardio-programmes", label: "Cardio programmes" },
  { key: "friends", href: "/clinic/vault/friends", label: "Meet David & Friends" },
];

const SETTINGS_TABS: TabDef[] = [
  { key: "equipment", href: "/clinic/vault/equipment", label: "Equipment" },
  { key: "phase-tags", href: "/clinic/vault/phase-tags", label: "Programme phases" },
  { key: "email-templates", href: "/clinic/vault/email-templates", label: "Email templates" },
];

function TabRow({ tabs, active }: { tabs: TabDef[]; active: VaultTab }) {
  return (
    <div className={styles.tabs}>
      {tabs.map((t) => (
        <Link key={t.key} href={t.href} className={`${styles.tab} ${active === t.key ? styles.tabActive : ""}`}>
          {t.label}
        </Link>
      ))}
    </div>
  );
}

export default function VaultTabs({ active }: { active: VaultTab }) {
  return (
    <div className={styles.tabGroups}>
      <div className={styles.tabGroup}>
        <div className={styles.tabGroupLabel}>Content</div>
        <TabRow tabs={CONTENT_TABS} active={active} />
      </div>
      <div className={styles.tabGroup}>
        <div className={styles.tabGroupLabel}>Settings</div>
        <TabRow tabs={SETTINGS_TABS} active={active} />
      </div>
    </div>
  );
}
