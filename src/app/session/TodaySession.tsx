"use client";

import { useState, type ReactNode } from "react";
import styles from "./TodaySession.module.css";
import SessionHeader from "./SessionHeader";
import AudioPlayer from "./AudioPlayer";
import ExerciseList, { completionKey, type SessionItem } from "./ExerciseList";

export type SessionProgrammeItem = SessionItem;

type Programme = {
  title: string;
  audio_url: string | null;
  programme_items: SessionProgrammeItem[];
};

export default function TodaySession({
  programmeId,
  firstName,
  programme,
  initialDoneIds,
  banner,
}: {
  programmeId: string;
  firstName: string;
  programme: Programme;
  initialDoneIds: string[];
  banner?: ReactNode;
}) {
  const items = programme.programme_items;
  // Keyed on the item's own library id (exercise_id, or a cardio block's
  // id), not the resolved item's row id -- block/workout content is
  // deleted-and-reinserted on every edit (fresh ids each time), so the
  // library id is what actually stays stable across those edits. The two
  // id spaces never collide, so one Set covers both kinds.
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set(initialDoneIds));

  function toggleDone(id: string, kind: "exercise" | "cardio") {
    const wasDone = doneIds.has(id);
    setDoneIds((prev) => {
      const next = new Set(prev);
      if (wasDone) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    fetch("/api/session/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exercise_id: kind === "exercise" ? id : undefined,
        cardio_block_id: kind === "cardio" ? id : undefined,
        done: !wasDone,
        programme_id: programmeId,
      }),
    }).catch(() => {
      // Best-effort persistence -- the on-screen toggle already reflects
      // the tap either way; a failed save just means it may not survive a
      // reload this one time.
    });
  }

  return (
    <div className={styles.app}>
      <div className={styles.inner}>
        <SessionHeader firstName={firstName} eyebrow="Today's session" subtitle={programme.title} banner={banner} />

        {programme.audio_url && (
          <div className={styles.messageCard}>
            <AudioPlayer src={programme.audio_url} label="A word from David" />
          </div>
        )}

        <div className={styles.progress}>
          <div className={styles.pdots}>
            {items.map((item) => (
              <span key={item.id} className={`${styles.pdot} ${doneIds.has(completionKey(item)) ? styles.done : ""}`} />
            ))}
          </div>
          <span>
            {doneIds.size} of {items.length} done
          </span>
        </div>

        <ExerciseList items={items} completion={{ doneIds, onToggle: toggleDone }} />

        <div className={styles.footnote}>
          Something not feeling right? <b>Message David</b> (one message is included with your
          programme)
        </div>
      </div>
    </div>
  );
}
