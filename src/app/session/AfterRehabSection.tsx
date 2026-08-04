import Link from "next/link";
import { getPostFinishSuggestion } from "@/lib/shopSections";
import styles from "./TodaySession.module.css";

// A quiet, always-present pointer below Explore -- deliberately lighter in
// every dimension (heading size, colour, no card) than Explore itself, so
// it reads as something to notice on the way past rather than a second
// call to action competing with the shop tiles above it. Points at
// whichever section is flagged as the genuine "what's next after rehab"
// (see getPostFinishSuggestion in shopSections.ts); renders nothing if
// none is set, rather than link to something invented.
export default function AfterRehabSection() {
  const section = getPostFinishSuggestion();
  if (!section) return null;

  return (
    <div className={styles.afterRehab}>
      <div className={styles.afterRehabHeading}>After your rehab</div>
      <p className={styles.afterRehabLine}>
        What we&apos;ve built together doesn&apos;t have to end when your rehab does.
      </p>
      <Link href={`/shop/${section.slug}`} className={styles.afterRehabLink}>
        See what continuing your journey looks like →
      </Link>
    </div>
  );
}
