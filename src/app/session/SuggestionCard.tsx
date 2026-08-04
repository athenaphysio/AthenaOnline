import Link from "next/link";
import styles from "./TodaySession.module.css";
import type { ShopSection } from "@/lib/shopSections";

// One calm line, never a tile, never bold colour -- the Explore section
// below is where browsing happens; this is a single, quiet nudge, matched
// to where the client actually is right now.
export default function SuggestionCard({ section }: { section: ShopSection }) {
  return (
    <Link href="/membership/continue" className={styles.suggestionCard}>
      <span className={styles.suggestionText}>
        Finished your rehab? <b>{section.name}</b> {section.postFinishSuggestion}
      </span>
      <span className={styles.suggestionArrow}>→</span>
    </Link>
  );
}
