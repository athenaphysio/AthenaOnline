"use client";

import { useState } from "react";
import styles from "./TodaySession.module.css";
import { prescriptionChips, prescriptionSummary } from "@/lib/prescription";
import { cardioModalityLabel, cardioPlainSummary } from "@/lib/cardioBlock";
import type { CardioBlockDetail } from "@/lib/cardioBlock";
import type { VimeoInfo } from "@/lib/vimeo";
import Pm5ButtonKeyImage from "@/components/Pm5ButtonKeyImage";
import { categoryMeta, type BlockCategory } from "@/lib/blockCategory";
import { badgeForSequenceType, needsSideIndicator, type SequenceType } from "@/lib/sequenceType";
import type { PrescriptionMode } from "@/lib/prescriptionMode";
import { runPlainSummary, type RunBlockFields } from "@/lib/runBlock";

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
  prescription_mode: PrescriptionMode;
  rationale: string | null;
  exercises: Exercise;
  video: VimeoInfo | null;
  category: BlockCategory;
  blockRefId: string | null;
  sequenceType: SequenceType;
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
  // Set when this run directly follows a cycling cardio item in the same
  // workout -- a brick. See workoutResolution.ts's toSessionItems, which
  // detects the ordering; no clinician-set flag involved.
  brickTransitionNote?: string | null;
  category: BlockCategory;
  blockRefId: string | null;
  sequenceType: SequenceType;
};

// A Run block: no video, no sets/reps/hold grid, no shared library row --
// its own fields sit directly on the workout item (see 0084_run_blocks.sql
// and runBlock.ts). Reads as one plain sentence rather than the exercise
// chip row, same treatment cardio gets.
export type SessionRunItem = {
  kind: "run";
  id: string;
  item_order: number;
  rationale: string | null;
  run: RunBlockFields;
  /** The stable id completion keys on -- see completionKey below. Never
   * actually null in practice for a real Run block (the column defaults
   * to a fresh uuid), but typed loosely to match how the row arrives. */
  run_stable_id: string | null;
  category: BlockCategory;
  blockRefId: string | null;
  sequenceType: SequenceType;
};

export type SessionItem = SessionExerciseItem | SessionCardioItem | SessionRunItem;

// The stable id "mark as done" keys on for a given item -- an exercise's
// library id, a cardio block's library id, or a Run block's own client-
// generated stable id, either way something that survives the workout
// being edited (fresh row ids every time), unlike the resolved item's own
// id.
export function completionKey(item: SessionItem): string {
  if (item.kind === "cardio") return item.cardio.id;
  if (item.kind === "run") return item.run_stable_id ?? item.id;
  return item.exercises.exercise_id;
}

export type RunCompletionAnswers = { quality: "finished" | "partial" | "not_done"; pain: number };

type Props = {
  items: SessionItem[];
  /** Only Scheduled sessions track completion -- an Open routine has
   * nothing to be "on" or "off" for, so this is omitted there and no Mark
   * as done button renders at all. */
  completion?: {
    doneIds: Set<string>;
    /** extra is only ever sent for kind "run", marking it done -- the two
     * quick questions asked right there (see the inline form below), never
     * asked again when un-marking. */
    onToggle: (id: string, kind: "exercise" | "cardio" | "run", extra?: RunCompletionAnswers) => void;
  };
};

const QUALITY_OPTIONS: { value: RunCompletionAnswers["quality"]; label: string }[] = [
  { value: "finished", label: "Yes" },
  { value: "partial", label: "Partly" },
  { value: "not_done", label: "No" },
];

// The item-by-item rendering shared by TodaySession (Scheduled) and
// OpenRoutine (Open) -- video, name, dose, "why am I doing this," and
// (Scheduled only, via `completion`) the done toggle. Cardio blocks share
// the same card shell and the same done toggle, minus video and the
// exercise-style chip row.
export default function ExerciseList({ items, completion }: Props) {
  const sorted = [...items].sort((a, b) => a.item_order - b.item_order);
  const [expandedId, setExpandedId] = useState<string | null>(sorted[0]?.id ?? null);
  // Which side each unilateral/alternating block is currently on -- purely
  // local, session-scoped UI state, same footing as expandedId above. Keyed
  // by blockRefId so it's shared across every exercise in that block's
  // group, not tracked per exercise.
  const [sideByBlock, setSideByBlock] = useState<Record<string, "right" | "left">>({});
  // Which Run item currently has the "how did that go" form open -- opened
  // by tapping Mark as done on a not-yet-done Run item instead of
  // completing it straight away; un-marking an already-done Run item skips
  // this and just calls onToggle directly, no re-asking.
  const [runFormOpenId, setRunFormOpenId] = useState<string | null>(null);
  const [runQuality, setRunQuality] = useState<RunCompletionAnswers["quality"] | null>(null);
  const [runPain, setRunPain] = useState(0);

  function closeRunForm() {
    setRunFormOpenId(null);
    setRunQuality(null);
    setRunPain(0);
  }

  return (
    <div className={styles.list}>
      {sorted.map((item, index) => {
        const displayName =
          item.kind === "cardio"
            ? item.cardio.name
            : item.kind === "run"
              ? item.run.run_title || "Run"
              : item.exercises.name_patient_facing || item.exercises.name_clinical;
        const isExpanded = item.id === expandedId;
        const isDone = completion?.doneIds.has(completionKey(item)) ?? false;
        const meta = categoryMeta(item.category);

        // The badge and side indicator sit once above a block's exercises,
        // not repeated per row -- true exactly when this item starts a new
        // block group (including the very first item, and any standalone/
        // cardio item, which are always their own trivial group of one).
        const isGroupStart = index === 0 || item.blockRefId !== sorted[index - 1].blockRefId || item.blockRefId == null;
        const badgeLabel = isGroupStart ? badgeForSequenceType(item.sequenceType) : null;
        const showSideIndicator = isGroupStart && needsSideIndicator(item.sequenceType);
        const sideKey = item.blockRefId ?? item.id;
        const currentSide = sideByBlock[sideKey] ?? "right";

        const groupHeader = (badgeLabel || showSideIndicator) && (
          <div className={styles.seqGroupHeader}>
            {badgeLabel && (
              <span className={styles.seqBadge} style={meta ? { background: meta.accent } : undefined}>
                {badgeLabel}
              </span>
            )}
            {showSideIndicator && (
              <div className={styles.sidePillRow}>
                <button
                  type="button"
                  className={`${styles.sidePill} ${currentSide === "right" ? styles.sidePillActive : ""}`}
                  onClick={() => setSideByBlock((prev) => ({ ...prev, [sideKey]: "right" }))}
                >
                  Right side
                </button>
                <button
                  type="button"
                  className={`${styles.sidePill} ${currentSide === "left" ? styles.sidePillActive : ""}`}
                  onClick={() => setSideByBlock((prev) => ({ ...prev, [sideKey]: "left" }))}
                >
                  Left side
                </button>
              </div>
            )}
          </div>
        );

        if (!isExpanded) {
          return (
            <div key={item.id}>
              {groupHeader}
              <button
                type="button"
                className={styles.row}
                style={meta ? { borderLeft: `3px solid ${meta.accent}` } : undefined}
                onClick={() => setExpandedId(item.id)}
              >
              <div className={styles.thumb}>
                <div className={styles.mini} />
              </div>
              <div className={styles.rmeta}>
                <div className={styles.rn}>{displayName}</div>
                <div className={styles.rd}>
                  {item.kind === "cardio"
                    ? `${cardioModalityLabel(item.cardio.modality, item.cardio.modality_other)} · ${cardioPlainSummary(item.cardio)}`
                    : item.kind === "run"
                      ? runPlainSummary(item.run)
                      : prescriptionSummary(item)}
                </div>
              </div>
              <div className={styles.chevr}>&rsaquo;</div>
              </button>
            </div>
          );
        }

        return (
          <div key={item.id}>
            {groupHeader}
            <div className={styles.card} style={meta ? { borderLeft: `3px solid ${meta.accent}` } : undefined}>
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
              <div className={styles.xname} style={item.kind === "cardio" || item.kind === "run" ? { marginTop: 4 } : undefined}>
                {displayName}
              </div>

              {item.kind === "run" ? (
                <>
                  <p className={styles.cardioPlain}>{runPlainSummary(item.run)}</p>
                  {item.run.run_warmup_walk && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: "10px 12px",
                        background: "var(--mist)",
                        borderRadius: 10,
                        fontSize: 13,
                        color: "var(--graphite)",
                        lineHeight: 1.5,
                      }}
                    >
                      <strong>Warm-up walk:</strong> {item.run.run_warmup_walk}
                    </div>
                  )}
                  {item.run.run_effort_cue && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: "10px 12px",
                        background: "var(--mist)",
                        borderRadius: 10,
                        fontSize: 13,
                        color: "var(--graphite)",
                        lineHeight: 1.5,
                      }}
                    >
                      <strong>Cue:</strong> {item.run.run_effort_cue}
                    </div>
                  )}
                  {item.run.run_surface && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: "10px 12px",
                        background: "var(--mist)",
                        borderRadius: 10,
                        fontSize: 13,
                        color: "var(--graphite)",
                        lineHeight: 1.5,
                      }}
                    >
                      <strong>Surface:</strong> {item.run.run_surface}
                    </div>
                  )}
                  {item.run.run_cooldown && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: "10px 12px",
                        background: "var(--mist)",
                        borderRadius: 10,
                        fontSize: 13,
                        color: "var(--graphite)",
                        lineHeight: 1.5,
                      }}
                    >
                      <strong>Cool-down:</strong> {item.run.run_cooldown}
                    </div>
                  )}
                </>
              ) : item.kind === "cardio" ? (
                <>
                  <p className={styles.cardioPlain}>{cardioPlainSummary(item.cardio)}</p>
                  {item.cardio.button_sequence_pm5 && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: "10px 12px",
                        background: "var(--mist)",
                        borderRadius: 10,
                        fontSize: 13,
                        color: "var(--graphite)",
                        lineHeight: 1.5,
                      }}
                    >
                      <strong>Button sequence:</strong> {item.cardio.button_sequence_pm5}
                      {item.cardio.button_sequence_pm3_4 &&
                        item.cardio.button_sequence_pm3_4 !== item.cardio.button_sequence_pm5 && (
                          <div style={{ fontSize: 12.5, marginTop: 4 }}>
                            PM3/PM4: {item.cardio.button_sequence_pm3_4}
                          </div>
                        )}
                      <Pm5ButtonKeyImage className={styles.cardioButtonKeyImage} />
                    </div>
                  )}
                  {item.brickTransitionNote && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: "10px 12px",
                        background: "var(--mist)",
                        borderRadius: 10,
                        fontSize: 13,
                        color: "var(--graphite)",
                        lineHeight: 1.5,
                      }}
                    >
                      <strong>Coming off the bike:</strong> {item.brickTransitionNote}
                    </div>
                  )}
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
                  {item.cardio.coaching_note && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: "10px 12px",
                        background: "var(--mist)",
                        borderRadius: 10,
                        fontSize: 13,
                        color: "var(--graphite)",
                        lineHeight: 1.5,
                      }}
                    >
                      <strong>Cue:</strong> {item.cardio.coaching_note}
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

              {completion && item.kind === "run" && !isDone && runFormOpenId === item.id && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "14px 14px 16px",
                    background: "var(--mist)",
                    borderRadius: 10,
                  }}
                >
                  <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 8 }}>
                    Did you finish the session as written?
                  </div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                    {QUALITY_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`${styles.sidePill} ${runQuality === opt.value ? styles.sidePillActive : ""}`}
                        onClick={() => setRunQuality(opt.value)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 8 }}>
                    Pain during the run
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      step={1}
                      value={runPain}
                      onChange={(e) => setRunPain(Number(e.target.value))}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontSize: 15, fontWeight: 600, minWidth: 20, textAlign: "center" }}>{runPain}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className={styles.doneButton} style={{ flex: 1 }} onClick={closeRunForm}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={styles.doneButton}
                      style={{ flex: 1 }}
                      disabled={!runQuality}
                      onClick={() => {
                        if (!runQuality) return;
                        completion.onToggle(completionKey(item), "run", { quality: runQuality, pain: runPain });
                        closeRunForm();
                      }}
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}

              {completion && !(item.kind === "run" && !isDone && runFormOpenId === item.id) && (
                <button
                  type="button"
                  className={`${styles.doneButton} ${isDone ? styles.isDone : ""}`}
                  onClick={() => {
                    if (item.kind === "run" && !isDone) {
                      setRunFormOpenId(item.id);
                      return;
                    }
                    completion.onToggle(completionKey(item), item.kind);
                  }}
                >
                  {isDone ? "Done ✓" : "Mark as done"}
                </button>
              )}
            </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
