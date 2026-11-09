"use client";

import { useState, type ReactNode } from "react";
import styles from "./TodaySession.module.css";
import SessionHeader from "./SessionHeader";
import AudioPlayer from "./AudioPlayer";
import ExerciseList, { completionKey, type SessionItem, type RunCompletionAnswers } from "./ExerciseList";
import MessageThread from "./MessageThread";
import VoiceNoteButton from "./VoiceNoteButton";
import { brandScopeStyle, paletteAttr } from "./brandScopeStyle";
import type { ResolvedBrandPack } from "@/lib/brandPackResolve";
import type { BackTarget } from "./BackLink";

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
  targetWeek,
  targetDay,
  anyDayWorkoutId = null,
  eyebrow = "Today's session",
  brand,
  back,
  showMessages = false,
}: {
  back?: BackTarget;
  /** Show the "Message David" line under the session. */
  showMessages?: boolean;
  programmeId: string;
  firstName: string;
  programme: Programme;
  initialDoneIds: string[];
  banner?: ReactNode;
  brand?: ResolvedBrandPack;
  /** Which week/day this session actually is -- always today's own unless
   * the patient arrived here via a "Do it now" catch-up link for a missed
   * session earlier in the week. Sent with every completion toggle so a
   * catch-up completion is recorded against the session it actually
   * belongs to, not silently against today. */
  targetWeek?: number;
  targetDay?: number;
  /** Set for a session done on any day of the week: completions carry it. */
  anyDayWorkoutId?: string | null;
  eyebrow?: string;
}) {
  const items = programme.programme_items;
  // Keyed on the item's own library id (exercise_id, or a cardio block's
  // id), not the resolved item's row id -- block/workout content is
  // deleted-and-reinserted on every edit (fresh ids each time), so the
  // library id is what actually stays stable across those edits. The two
  // id spaces never collide, so one Set covers both kinds.
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set(initialDoneIds));

  function toggleDone(id: string, kind: "exercise" | "cardio" | "run", runAnswers?: RunCompletionAnswers) {
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
        run_stable_id: kind === "run" ? id : undefined,
        done: !wasDone,
        programme_id: programmeId,
        week_number: targetWeek,
        day_of_week: targetDay,
        workout_id: anyDayWorkoutId ?? undefined,
        run_completion_quality: runAnswers?.quality,
        run_pain_score: runAnswers?.pain,
      }),
    }).catch(() => {
      // Best-effort persistence -- the on-screen toggle already reflects
      // the tap either way; a failed save just means it may not survive a
      // reload this one time.
    });
  }

  return (
    <div className={styles.app} style={brandScopeStyle(brand)} {...paletteAttr(brand)}>
      <div className={styles.inner}>
        <SessionHeader firstName={firstName} eyebrow={eyebrow} subtitle={programme.title} banner={banner} brand={brand} back={back} />

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

        {doneIds.size > 0 && (
          <div style={{ padding: "0 22px" }}>
            <VoiceNoteButton
              programmeId={programmeId}
              weekNumber={targetWeek ?? null}
              dayOfWeek={targetDay ?? null}
              contextTitle={programme.title}
              prompt={
                items.some((i) => i.kind === "exercise")
                  ? "Which weights did you use, how hard did the last sets feel out of 10, any pain, and anything you weren't sure you were getting right? Up to two minutes, in your own words."
                  : undefined
              }
            />
          </div>
        )}

        {showMessages && <MessageThread programmeId={programmeId} />}
      </div>
    </div>
  );
}
