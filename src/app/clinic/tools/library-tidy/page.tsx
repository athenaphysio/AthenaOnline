import Link from "next/link";
import styles from "../../clinic.module.css";
import ClinicBrandbar from "../../ClinicBrandbar";
import { loadTidyItems } from "@/lib/libraryTidy";
import LibraryTidyClient from "./LibraryTidyClient";

export const dynamic = "force-dynamic";

export default async function LibraryTidyPage() {
  const items = await loadTidyItems();
  return (
    <div className={styles.app}>
      <div className={styles.inner}>
        <ClinicBrandbar />
        <h1 className={styles.heading}>Tidy the library</h1>
        <p className={styles.subheading}>
          <Link href="/clinic/tools" className={styles.canvasLink}>
            ← Tools
          </Link>
        </p>
        <p className={styles.notice} style={{ color: "var(--clinic-on-canvas-muted)" }}>
          These look like test or leftover items. Tick the ones to remove. Anything still used in a saved programme
          is marked and cannot be deleted.
        </p>
        <LibraryTidyClient items={items} />
      </div>
    </div>
  );
}
