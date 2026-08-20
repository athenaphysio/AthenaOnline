"use client";

import type { ReactNode } from "react";
import styles from "./BuilderShell.module.css";

type Props = {
  /** The content library: search, filters, and the list of things that can
   * be added. Pinned, so it stays available however far the centre scrolls.
   * Pass null for a builder that has nothing to pick from. */
  library: ReactNode;
  libraryTitle?: string;
  /** What is being built, as the client will see it. The only column that
   * scrolls with the page. */
  centre: ReactNode;
  /** Every setting for the thing being built, as cards inside one panel.
   * Pass null for a builder that has moved its settings elsewhere on the
   * page (a top bar, a section below the shell) rather than keeping them
   * in a persistent rail -- the centre then expands to take that width. */
  controls: ReactNode | null;
  controlsTitle?: string;
};

// One layout shared by the Workout builder, the Block builder, and the
// Programme builder, so all three pin the same way and a control sits in
// the same place on every one of them. See BuilderShell.module.css for why
// the rails can be pinned at all.
export default function BuilderShell({
  library,
  libraryTitle = "Library",
  centre,
  controls,
  controlsTitle,
}: Props) {
  // A builder with no controls rail has moved its settings into normal page
  // flow above/below this shell (a top bar, a section underneath) -- that
  // only works if the shell itself scrolls with the page too. Pinning it
  // (sticky + 100vh, see shellPinned below) would trap the page's own
  // scroll inside the shell's two remaining columns, making whatever comes
  // after it unreachable by an ordinary scroll.
  const flow = controls === null;

  return (
    <div
      className={`${styles.shell} ${flow ? styles.shellFlow : styles.shellPinned} ${
        library === null ? styles.shellNoLibrary : ""
      } ${controls === null ? styles.shellNoControls : ""}`}
    >
      {library !== null && (
        <aside className={styles.rail}>
          <h2 className={styles.railTitle}>{libraryTitle}</h2>
          {library}
        </aside>
      )}

      <div className={styles.centre}>{centre}</div>

      {controls !== null && (
        <aside className={styles.rail}>
          {controlsTitle && <h2 className={styles.railTitle}>{controlsTitle}</h2>}
          {controls}
        </aside>
      )}
    </div>
  );
}
