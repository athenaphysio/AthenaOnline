"use client";

import { useState } from "react";
import styles from "./TodaySession.module.css";
import { prescriptionChips, prescriptionSummary } from "@/lib/prescription";
import { cardioModalityLabel, cardioPlainSummary } from "@/lib/cardioBlock";
import type { CardioBlockDetail } from "@/lib/cardioBlock";
import type { VimeoInfo } from "@/lib/vimeo";

type Exercise = {
  exercise_id: string;
  name_clinical: string;
  name_patient_facing: string | null;
};

export type SessionExerciseItem = {
  kind: "exercise";
  id: string;
  item_order: number;
  sets: number | null;
  reps: number | null;
  hold_seconds: number | null;
  percent_max: number | null;
  frequency: string | null;
  rationale: string | null;
  exercises: Exercise;
  video: VimeoInfo | null;
};

// A cardio block has no video and no sets/reps/hold grid -- it carries its
// own dose (modality, structure, target metrics) read in plain terms
// instead of the exercise chip row. It shares completion tracking with
// exercises (session_completions.cardio_block_id, 0037_cardio_completion.sql).
export type SessionCardioItem = {
  kind: "cardio";
  id: string;
  item_order: number;
  rationale: string | null;
  cardio: CardioBlockDetail;
};

export type SessionItem = SessionExerciseItem | SessionCardioItem;

// The stable id "mark as done" keys on for a given item -- an exercise's
// library id or a cardio block's library id, either way something that
// survives the workout being edited (fresh row ids every time), unlike the
// resolved item's own id.
export function completionKey(item: SessionItem): string {
  return item.kind === "cardio" ? item.cardio.id : item.exercises.exercise_id;
}

type Props = {
  items: SessionItem[];
  /** Only Scheduled sessions track completion -- an Open routine has
   * nothing to be "on" or "off" for, so this is omitted there and no Mark
   * as done button renders at all. */
  completion?: {
    doneIds: Set<string>;
    onToggle: (id: string, kind: "exercise" | "cardio") => void;
  };
};

// The item-by-item rendering shared by TodaySession (Scheduled) and
// OpenRoutine (Open) -- video, name, dose, "why am I doing this," and
// (Scheduled only, via `completion`) the done toggle. Cardio blocks share
// the same card shell and the same done toggle, minus video and the
// exercise-style chip row.
export default function ExerciseList({ items, completion }: Props) {
  const sorted = [...items].sort((a, b) => a.item_order - b.item_order);
  const [expandedId, setExpandedId] = useState<string | null>(sorted[0]?.id ?? null);

  return (
    <div className={styles.list}>
      {sorted.map((item, index) => {
        const displayName =
          item.kind === "cardio" ? item.cardio.name : item.exercises.name_patient_facing || item.exercises.name_clinical;
        const isExpanded = item.id === expandedId;
        const isDone = completion?.doneIds.has(completionKey(item)) ?? false;

        if (!isExpanded) {
          return (
            <button key={item.id} type="button" className={styles.row} onClick={() => setExpandedId(item.id)}>
              <div className={styles.thumb}>
                <div className={styles.mini} />
              </div>
              <div className={styles.rmeta}>
                <div className={styles.rn}>{displayName}</div>
                <div className={styles.rd}>
                  {item.kind === "cardio"
                    ? `${cardioModalityLabel(item.cardio.modality, item.cardio.modality_other)} · ${cardioPlainSummary(item.cardio)}`
                    : prescriptionSummary(item)}
                </div>
              </div>
              <div className={styles.chevr}>&rsaquo;</div>
            </button>
          );
        }

        return (
          <div key={item.id} className={styles.card}>
            {item.kind === "exercise" &&
              (item.video ? (
                <div className={styles.videoEmbed} style={{ aspectRatio: item.video.aspectRatio }}>
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
              ))}
            <div className={styles.body}>
              {item.kind === "cardio" && (
                <div className={styles.eyebrow}>{cardioModalityLabel(item.cardio.modality, item.cardio.modality_other)}</div>
              )}
              <div className={styles.xname} style={item.kind === "cardio" ? { marginTop: 4 } : undefined}>
                {displayName}
              </div>

              {item.kind === "cardio" ? (
                <>
                  <p className={styles.cardioPlain}>{cardioPlainSummary(item.cardio)}</p>
                  {item.cardio.stop_rule && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: "10px 12px",
                        background: "var(--crimson-light)",
                        borderRadius: 10,
                        fontSize: 13,
                        color: "var(--crimson-dark)",
                        lineHeight: 1.5,
                      }}
                    >
                      <strong>Stop and get in touch with David if:</strong> {item.cardio.stop_rule}
                    </div>
                  )}
                </>
              ) : (
                (() => {
                  const chips = prescriptionChips(item);
                  return (
                    chips.length > 0 && (
                      <div className={styles.dose}>
                        {chips.map((chip) => (
                          <span key={chip} className={styles.chip}>
                            {chip}
                          </span>
                        ))}
                      </div>
                    )
                  );
                })()
              )}

              {item.rationale && (
                <details className={styles.details}>
                  <summary className={styles.summary}>
                    Why am I doing this? <span className={styles.chev}>&#8964;</span>
                  </summary>
                  <div className={styles.why}>{item.rationale}</div>
                </details>
              )}

              {completion && (
                <button
                  type="button"
                  className={`${styles.doneButton} ${isDone ? styles.isDone : ""}`}
                  onClick={() => completion.onToggle(completionKey(item), item.kind)}
                >
                  {isDone ? "Done ✓" : "Mark as done"}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
