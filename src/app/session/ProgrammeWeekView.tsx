"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./TodaySession.module.css";
import VoiceNoteButton from "./VoiceNoteButton";
import GoalPathChart from "@/components/rowing/GoalPathChart";
import type { GoalPath } from "@/lib/rowing/goalPath";
import { formatMeasure } from "@/lib/rowing/goalPath";
import RunCircuitSession, { type ClientCircuit } from "./RunCircuitSession";
import FlareBox from "./FlareBox";
import { useT } from "@/i18n/client";

export type WeekCard = {
  kind: "card";
  workoutId: string;
  title: string;
  type: string;
  summary: string;
  steps: { label: string; detail: string }[];
  target: string;
  total: string;
  notes: string;
  done: boolean;
  /** Set on a Run Circuit card. */
  circuit?: ClientCircuit | null;
};

export type WeekWorkout = {
  kind: "workout";
  workoutId: string;
  title: string;
  /** Opens the usual session screen for this session. */
  href: string;
  done: boolean;
  /** A strength slot David hasn't filled yet. */
  empty: boolean;
};

export type WeekDay = {
  day: number;
  label: string;
  rest: boolean;
  sessions: (WeekCard | WeekWorkout)[];
};

type Props = {
  programmeId: string;
  title: string;
  intro: string;
  weekNumber: number;
  totalWeeks: number;
  weekLabel: string;
  prevHref: string | null;
  nextHref: string | null;
  showIntro: boolean;
  rules: { move_on: string; flare: string } | null;
  days: WeekDay[];
  /** Sessions to do on any day this week, chosen by the client. */
  anyDay?: WeekWorkout[];
  /** Set for a Rowing and Running Builder plan: the client's own path to their goal. */
  goalPath?: GoalPath | null;
};

const TYPE_LABEL = {
  run: "practice.typeRun",
  bike: "practice.typeBike",
  swim: "practice.typeSwim",
  row: "practice.typeRow",
  strength: "practice.typeStrength",
  other: "practice.typeOther",
  run_circuit: "practice.typeRunCircuit",
} as const;
const TYPE_COLOR: Record<string, string> = {
  run: "#9B1C1C",
  bike: "#1C6B9B",
  swim: "#1C9B7E",
  row: "#2F5D8A",
  strength: "#6B4FA0",
  other: "#B08A2E",
  run_circuit: "#9B1C1C",
};

type Quality = "finished" | "partial" | "not_done";

function Dot({ type }: { type: string }) {
  return (
    <span
      style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: TYPE_COLOR[type] ?? "#8A8A8A", marginRight: 6 }}
    />
  );
}

function QualityPills({ value, onChange }: { value: Quality | null; onChange: (v: Quality) => void }) {
  const { t } = useT();
  const options: { value: Quality; label: string }[] = [
    { value: "finished", label: t("practice.yes") },
    { value: "partial", label: t("practice.partly") },
    { value: "not_done", label: t("practice.no") },
  ];
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`${styles.sidePill} ${value === opt.value ? styles.sidePillActive : ""}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function CompleteForm({
  programmeId,
  workoutId,
  weekNumber,
  onDone,
}: {
  programmeId: string;
  workoutId: string;
  weekNumber: number;
  onDone: () => void;
}) {
  const { t } = useT();
  const [quality, setQuality] = useState<Quality | null>(null);
  const [pain, setPain] = useState(0);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!quality) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/session/card-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programme_id: programmeId, workout_id: workoutId, week_number: weekNumber, quality, pain, note }),
      });
      if (!res.ok) throw new Error((await res.json()).error || t("practice.didntSave"));
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("practice.didntSave"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ marginTop: 12, padding: "14px 14px 16px", background: "var(--mist)", borderRadius: 10 }}>
      <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 8 }}>{t("practice.finishedItAsWritten")}</div>
      <QualityPills value={quality} onChange={setQuality} />

      <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 8 }}>{t("practice.painDuring")}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <input type="range" min={0} max={10} step={1} value={pain} onChange={(e) => setPain(Number(e.target.value))} style={{ flex: 1 }} />
        <span style={{ fontSize: 15, fontWeight: 600, minWidth: 20, textAlign: "center" }}>{pain}</span>
      </div>

      <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 8 }}>{t("practice.tellDavidOptional")}</div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t("practice.optional")}
        style={{ width: "100%", minHeight: 60, borderRadius: 8, border: "1px solid var(--stone)", padding: 8, fontSize: 13.5, marginBottom: 14, boxSizing: "border-box" }}
      />
      {error && <div style={{ fontSize: 13, color: "var(--crimson-dark)", marginBottom: 8 }}>{error}</div>}
      <button type="button" className={styles.doneButton} disabled={!quality || submitting} onClick={submit}>
        {submitting ? t("practice.saving") : t("practice.save")}
      </button>
    </div>
  );
}

function CardRow({
  session,
  programmeId,
  weekNumber,
  dayNumber,
  flareRuleText,
}: {
  session: WeekCard;
  programmeId: string;
  weekNumber: number;
  dayNumber: number;
  flareRuleText: string | null;
}) {
  const { t } = useT();
  const [expanded, setExpanded] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [done, setDone] = useState(session.done);

  if (session.circuit) {
    return (
      <RunCircuitSession
        programmeId={programmeId}
        workoutId={session.workoutId}
        weekNumber={weekNumber}
        dayNumber={dayNumber}
        title={session.title}
        summary={session.summary}
        notes={session.notes}
        circuit={session.circuit}
        done={session.done}
        flareRuleText={flareRuleText}
      />
    );
  }

  if (!expanded) {
    return (
      <button type="button" className={styles.row} onClick={() => setExpanded(true)}>
        <div className={styles.thumb}>
          <div className={styles.mini} />
        </div>
        <div className={styles.rmeta}>
          <div className={styles.rn}>
            <Dot type={session.type} />
            {session.title}
            {done ? ` ${t("practice.doneSuffix")}` : ""}
          </div>
          <div className={styles.rd}>{session.summary || (session.type in TYPE_LABEL ? t(TYPE_LABEL[session.type as keyof typeof TYPE_LABEL]) : "")}</div>
        </div>
        <div className={styles.chevr}>&rsaquo;</div>
      </button>
    );
  }

  return (
    <div className={styles.card}>
     <div style={{ padding: "14px 16px 16px" }}>
      <div className={styles.xname}>
        <Dot type={session.type} />
        {session.title}
      </div>
      {session.summary && <p className={styles.cardioPlain}>{session.summary}</p>}
      {(session.target || session.total) && (
        <p className={styles.cardioPlain}>
          {session.target}
          {session.target && session.total ? " · " : ""}
          {session.total}
        </p>
      )}
      {session.steps.length > 0 && (
        <ul style={{ margin: "8px 0", paddingLeft: 18, fontSize: 13.5 }}>
          {session.steps.map((step, i) => (
            <li key={i} style={{ marginBottom: 4 }}>
              {step.label ? <strong>{step.label}: </strong> : null}
              {step.detail}
            </li>
          ))}
        </ul>
      )}
      {session.notes && (
        <details className={styles.details}>
          <summary className={styles.summary}>
            {t("practice.notes")} <span className={styles.chev}>&#8964;</span>
          </summary>
          <div className={styles.why}>{session.notes}</div>
        </details>
      )}

      {done ? (
        <button type="button" className={`${styles.doneButton} ${styles.isDone}`} disabled>
          {t("practice.doneTick")}
        </button>
      ) : completing ? (
        <CompleteForm
          programmeId={programmeId}
          workoutId={session.workoutId}
          weekNumber={weekNumber}
          onDone={() => {
            setDone(true);
            setCompleting(false);
          }}
        />
      ) : (
        <button type="button" className={styles.doneButton} onClick={() => setCompleting(true)}>
          {t("practice.markComplete")}
        </button>
      )}

      {(done || completing) && (
        <VoiceNoteButton
          programmeId={programmeId}
          workoutId={session.workoutId}
          weekNumber={weekNumber}
          dayOfWeek={dayNumber}
          contextTitle={session.title}
        />
      )}

      {flareRuleText && session.type === "run" && !done && (
        <FlareBox programmeId={programmeId} weekNumber={weekNumber} flareRuleText={flareRuleText} />
      )}
     </div>
    </div>
  );
}

function WorkoutRow({ session }: { session: WeekWorkout }) {
  const { t } = useT();
  if (session.empty) {
    return (
      <div className={styles.row} style={{ opacity: 0.75 }}>
        <div className={styles.thumb}>
          <div className={styles.mini} />
        </div>
        <div className={styles.rmeta}>
          <div className={styles.rn}>
            <Dot type="strength" />
            {session.title}
          </div>
          <div className={styles.rd}>{t("practice.davidWillAdd")}</div>
        </div>
      </div>
    );
  }
  return (
    <Link href={session.href} className={styles.row} style={{ textDecoration: "none" }}>
      <div className={styles.thumb}>
        <div className={styles.mini} />
      </div>
      <div className={styles.rmeta}>
        <div className={styles.rn}>
          <Dot type="strength" />
          {session.title}
          {session.done ? ` ${t("practice.doneSuffix")}` : ""}
        </div>
        <div className={styles.rd}>{t("practice.strengthOpen")}</div>
      </div>
      <div className={styles.chevr}>&rsaquo;</div>
    </Link>
  );
}

// One weekly view for a programme whose cardio sits next to its strength
// sessions, with logging for both: cardio cards here, strength through the
// usual session screen.
export default function ProgrammeWeekView({
  programmeId,
  title,
  intro,
  weekNumber,
  totalWeeks,
  weekLabel,
  prevHref,
  nextHref,
  showIntro,
  rules,
  days,
  anyDay = [],
  goalPath = null,
}: Props) {
  const { t } = useT();
  const [repeated, setRepeated] = useState(false);
  const [repeating, setRepeating] = useState(false);

  async function repeatWeek() {
    setRepeating(true);
    try {
      await fetch("/api/session/repeat-week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programme_id: programmeId, week_number: weekNumber, kind: "repeat_week" }),
      });
      setRepeated(true);
    } finally {
      setRepeating(false);
    }
  }

  return (
    <>
      <div style={{ padding: "18px 22px 0" }}>
        <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>{title}</h1>
        <div style={{ fontSize: 14, color: "var(--muted)", marginBottom: 4 }}>
          {t("practice.weekOf", { week: weekNumber, total: totalWeeks })}
        </div>
        {weekLabel && <div style={{ fontSize: 13, color: "var(--muted)" }}>{weekLabel}</div>}
      </div>

      {showIntro && intro && (
        <div className={styles.messageCard} style={{ margin: "14px 22px" }}>
          <p style={{ fontSize: 14, margin: 0 }}>{intro}</p>
        </div>
      )}

      {goalPath && (
        <div className={styles.messageCard} style={{ margin: "14px 22px" }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>
            {t("practice.yourPathTo", { goal: goalPath.goal ? goalPath.goal.label.replace(/^Goal /, "") : goalPath.eventName })}
          </div>
          <p style={{ fontSize: 13, margin: "0 0 8px", lineHeight: 1.5 }}>
            {goalPath.points.length > 1
              ? t("practice.latestTestPredicts", {
                  latest: formatMeasure(goalPath, goalPath.points[goalPath.points.length - 1].value),
                  first: formatMeasure(goalPath, goalPath.points[0].value),
                })
              : t("practice.entryTestPredicts", { first: formatMeasure(goalPath, goalPath.points[0].value) })}
          </p>
          <GoalPathChart path={goalPath} surface="var(--card-bg, #fff)" />
        </div>
      )}

      {days.some((d) => d.sessions.some((x) => x.kind === "card" && x.type === "row")) && (
        <div style={{ padding: "0 22px" }}>
          <Link href="/session/concept2" style={{ fontSize: 13.5, color: "var(--crimson-text, var(--crimson))" }}>
            {t("practice.rowingDataLink")} &rarr;
          </Link>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 22px" }}>
        {prevHref ? (
          <Link href={prevHref} style={{ fontSize: 14, color: "var(--crimson-text, var(--crimson))" }}>
            &larr; {t("practice.weekNumber", { week: weekNumber - 1 })}
          </Link>
        ) : (
          <span />
        )}
        {nextHref ? (
          <Link href={nextHref} style={{ fontSize: 14, color: "var(--crimson-text, var(--crimson))" }}>
            {t("practice.weekNumber", { week: weekNumber + 1 })} &rarr;
          </Link>
        ) : (
          <span />
        )}
      </div>

      <div className={styles.list}>
        {anyDay.length > 0 && (
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--muted)", padding: "10px 22px 4px" }}>
              {t("practice.anyDayThisWeek")}
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", padding: "0 22px 6px", lineHeight: 1.5 }}>
              {anyDay.length === 1 ? t("practice.anyDayOne") : t("practice.anyDayMany", { count: anyDay.length })}
            </div>
            {anyDay.map((s) => (
              <WorkoutRow key={s.workoutId} session={s} />
            ))}
          </div>
        )}
        {days.map((d) => (
          <div key={d.day} style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--muted)", padding: "10px 22px 4px" }}>
              {d.label}
            </div>
            {d.sessions.length === 0 ? (
              <div style={{ fontSize: 13.5, color: "var(--muted)", padding: "0 22px 8px" }}>{d.rest ? t("practice.rest") : t("practice.nothingPlanned")}</div>
            ) : (
              d.sessions.map((s) =>
                s.kind === "card" ? (
                  <CardRow
                    key={s.workoutId}
                    session={s}
                    programmeId={programmeId}
                    weekNumber={weekNumber}
                    dayNumber={d.day}
                    flareRuleText={rules?.flare ?? null}
                  />
                ) : (
                  <WorkoutRow key={s.workoutId} session={s} />
                )
              )
            )}
          </div>
        ))}
      </div>

      {rules && (
        <div style={{ margin: "20px 22px" }}>
          {repeated ? (
            <p style={{ fontSize: 13, color: "var(--stone)" }}>{t("practice.weekRepeats")}</p>
          ) : (
            <>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>{rules.move_on}</p>
              <button
                type="button"
                style={{ border: "1px solid var(--stone)", background: "var(--input-bg, #fff)", color: "var(--graphite)", borderRadius: 10, padding: "9px 16px", fontSize: 13.5 }}
                disabled={repeating}
                onClick={repeatWeek}
              >
                {repeating ? "…" : t("practice.repeatThisWeek")}
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
