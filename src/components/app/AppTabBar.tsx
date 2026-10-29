import Link from "next/link";
import type { ToolbarTab } from "@/lib/appLayout";
import styles from "./AppTabBar.module.css";

// The bottom toolbar of the client's app. Which tabs appear is set by the
// client's brand pack (see src/lib/appLayout.ts); Home always comes first.

const ICONS: Record<ToolbarTab["key"], React.ReactNode> = {
  home: <path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z" />,
  programme: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 9.5h16M8.5 3.5v3M15.5 3.5v3M8 13.5h3M8 16.5h6" />
    </>
  ),
  passport: (
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <path d="M8.5 15.5l2.5-3 2 2 2.5-4" />
    </>
  ),
  messages: <path d="M5 5.5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4.5 3.5v-3.5H5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" />,
  me: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c1-3.6 3.8-5.5 7-5.5s6 1.9 7 5.5" />
    </>
  ),
  team: (
    <>
      <circle cx="8.5" cy="9" r="2.8" />
      <circle cx="15.5" cy="9" r="2.8" />
      <path d="M3.5 19c.7-2.9 2.6-4.5 5-4.5s4.3 1.6 5 4.5M10.5 19c.7-2.9 2.6-4.5 5-4.5s4.3 1.6 5 4.5" />
    </>
  ),
};

export default function AppTabBar({ tabs, active, dark = false }: { tabs: ToolbarTab[]; active: ToolbarTab["key"]; dark?: boolean }) {
  if (tabs.length === 0) return null;
  return (
    <>
      <div className={styles.spacer} aria-hidden="true" />
      <nav className={`${styles.bar} ${dark ? styles.barDark : ""}`} aria-label="Main">
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <Link key={t.key} href={t.href} className={`${styles.tab} ${on ? styles.active : ""}`} aria-current={on ? "page" : undefined}>
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                {ICONS[t.key]}
              </svg>
              <span>{t.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
