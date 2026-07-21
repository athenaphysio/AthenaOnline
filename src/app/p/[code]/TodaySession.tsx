"use client";

import { useState } from "react";
import Image from "next/image";
import styles from "./TodaySession.module.css";
import { prescriptionChips, prescriptionSummary } from "@/lib/prescription";
import type { VimeoInfo } from "@/lib/vimeo";
import AudioPlayer from "./AudioPlayer";

type Exercise = {
  exercise_id: string;
  name_clinical: string;
  name_patient_facing: string | null;
};

export type SessionProgrammeItem = {
  id: string;
  item_order: number;
  sets: number | null;
  reps: number | null;
  hold_seconds: number | null;
  frequency: string | null;
  rationale: string | null;
  exercises: Exercise;
  video: VimeoInfo | null;
};

type Programme = {
  patient_first_name: string;
  title: string;
  audio_url: string | null;
  programme_items: SessionProgrammeItem[];
};

export default function TodaySession({ programme }: { programme: Programme }) {
  const items = [...programme.programme_items].sort((a, b) => a.item_order - b.item_order);
  const [expandedId, setExpandedId] = useState<string | null>(items[0]?.id ?? null);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  function toggleDone(id: string) {
    setDoneIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className={styles.app}>
      <div className={styles.inner}>
        <div className={styles.brandbar}>
          <Image src="/icons/athena-mark.png" alt="" width={26} height={26} />
          <div className={styles.brandname}>Athena Physio</div>
        </div>

        <div className={styles.head}>
          <div className={styles.eyebrow}>Today&apos;s session</div>
          <h1>
            Morning, <em>{programme.patient_first_name}.</em>
          </h1>
          <p>{programme.title}</p>
        </div>

        {programme.audio_url && (
          <div className={styles.messageCard}>
            <AudioPlayer src={programme.audio_url} label="A word from David" />
          </div>
        )}

        <div className={styles.progress}>
          <div className={styles.pdots}>
            {items.map((item) => (
              <span
                key={item.id}
                className={`${styles.pdot} ${doneIds.has(item.id) ? styles.done : ""}`}
              />
            ))}
          </div>
          <span>
            {doneIds.size} of {items.length} done
          </span>
        </div>

        <div className={styles.list}>
          {items.map((item, index) => {
            const exercise = item.exercises;
            const displayName = exercise.name_patient_facing || exercise.name_clinical;
            const isExpanded = item.id === expandedId;
            const isDone = doneIds.has(item.id);

            if (!isExpanded) {
              return (
                <button
                  key={item.id}
                  type="button"
                  className={styles.row}
                  onClick={() => setExpandedId(item.id)}
                >
                  <div className={styles.thumb}>
                    <div className={styles.mini} />
                  </div>
                  <div className={styles.rmeta}>
                    <div className={styles.rn}>{displayName}</div>
                    <div className={styles.rd}>{prescriptionSummary(item)}</div>
                  </div>
                  <div className={styles.chevr}>&rsaquo;</div>
                </button>
              );
            }

            const chips = prescriptionChips(item);

            return (
              <div key={item.id} className={styles.card}>
                {item.video ? (
                  <div
                    className={styles.videoEmbed}
                    style={{ aspectRatio: item.video.aspectRatio }}
                  >
                    {index === 0 && <div className={styles.vtag}>Start here</div>}
                    <iframe
                      src={item.video.embedUrl}
                      title={displayName}
                      allow="fullscreen; picture-in-picture"
                      allowFullScreen
                      className={styles.videoFrame}
                    />
                  </div>
                ) : (
                  <div className={styles.video}>
                    {index === 0 && <div className={styles.vtag}>Start here</div>}
                    <div className={styles.play} />
                  </div>
                )}
                <div className={styles.body}>
                  <div className={styles.xname}>{displayName}</div>

                  {chips.length > 0 && (
                    <div className={styles.dose}>
                      {chips.map((chip) => (
                        <span key={chip} className={styles.chip}>
                          {chip}
                        </span>
                      ))}
                    </div>
                  )}

                  {item.rationale && (
                    <details className={styles.details}>
                      <summary className={styles.summary}>
                        Why am I doing this? <span className={styles.chev}>&#8964;</span>
                      </summary>
                      <div className={styles.why}>{item.rationale}</div>
                    </details>
                  )}

                  <button
                    type="button"
                    className={`${styles.doneButton} ${isDone ? styles.isDone : ""}`}
                    onClick={() => toggleDone(item.id)}
                  >
                    {isDone ? "Done ✓" : "Mark as done"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className={styles.footnote}>
          Something not feeling right? <b>Message David</b> (one message is included with your
          programme)
        </div>
      </div>
    </div>
  );
}
