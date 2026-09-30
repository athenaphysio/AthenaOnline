"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "../session/TodaySession.module.css";
import type { PlanSession, PlanWeek } from "@/lib/athenaPlan";

type LogInfo = {
  session_id: string;
  completed_quality: "finished" | "partial" | "not_done" | null;
};

type Props = {
  importedPlanId: string;
  blockTitle: string;
  intro: string;
  week: PlanWeek;
  currentWeekNumber: number;
  totalWeeks: number;
  prevWeek: number | null;
  nextWeek: number | null;
  isFirstWeek: boolean;
  flareRuleText: string;
  moveOnText: string;
  logs: LogInfo[];
};

const TYPE_LABEL: Record<string, string> = {
  run: "Run",
  bike: "Bike",
  swim: "Swim",
  strength: "Strength",
  rest: "Rest",
  other: "Other",
};

const TYPE_COLOR: Record<string, string> = {
  run: "#9B1C1C",
  bike: "#1C6B9B",
  swim: "#1C9B7E",
  strength: "#6B4FA0",
  rest: "#8A8A8A",
  other: "#B08A2E",
};

const DAY_LABEL: Record<string, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
  any: "",
};

function TypeBadge({ type }: { type: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: 4,
        background: TYPE_COLOR[type] ?? "#8A8A8A",
        marginRight: 6,
      }}
    />
  );
}

function QualityPills({ value, onChange }: { value: "finished" | "partial" | "not_done" | null; onChange: (v: "finished" | "partial" | "not_done") => void }) {
  const options: { value: "finished" | "partial" | "not_done"; label: string }[] = [
    { value: "finished", label: "Yes" },
    { value: "partial", label: "Partly" },
    { value: "not_done", label: "No" },
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

function SessionCompleteForm({
  importedPlanId,
  session,
  onDone,
}: {
  importedPlanId: string;
  session: PlanSession;
  onDone: () => void;
}) {
  const [quality, setQuality] = useState<"finished" | "partial" | "not_done" | null>(null);
  const [pain, setPain] = useState(0);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!quality) return;
    setSubmitting(true);
    try {
      await fetch("/api/plan/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imported_plan_id: importedPlanId, session_id: session.id, quality, pain, note }),
      });
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ marginTop: 12, padding: "14px 14px 16px", background: "var(--mist)", borderRadius: 10 }}>
      <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 8 }}>Did you finish it as written?</div>
      <QualityPills value={quality} onChange={setQuality} />

      <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 8 }}>Pain during</div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <input type="range" min={0} max={10} step={1} value={pain} onChange={(e) => setPain(Number(e.target.value))} style={{ flex: 1 }} />
        <span style={{ fontSize: 15, fontWeight: 600, minWidth: 20, textAlign: "center" }}>{pain}</span>
      </div>

      <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 8 }}>Anything to tell David? (optional)</div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional"
        style={{ width: "100%", minHeight: 60, borderRadius: 8, border: "1px solid var(--stone)", padding: 8, fontSize: 13.5, marginBottom: 14, boxSizing: "border-box" }}
      />

      <button type="button" className={styles.doneButton} disabled={!quality || submitting} onClick={submit}>
        {submitting ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

function FlareBox({ importedPlanId, weekNumber, flareRuleText, onRepeat }: { importedPlanId: string; weekNumber: number; flareRuleText: string; onRepeat: () => void }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function repeat() {
    setSubmitting(true);
    try {
      await fetch("/api/plan/repeat-week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imported_plan_id: importedPlanId, week_number: weekNumber, kind: "flare_up" }),
      });
      setDone(true);
      onRepeat();
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <p style={{ fontSize: 13, color: "var(--stone)", marginTop: 10 }}>
        Noted. This week will repeat, and David has been told.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ marginTop: 10, border: "1px solid var(--stone)", background: "#fff", color: "var(--graphite)", borderRadius: 10, padding: "8px 14px", fontSize: 13 }}
      >
        Having a flare-up?
      </button>
    );
  }

  return (
    <div style={{ marginTop: 10, padding: "12px 14px", background: "var(--mist)", borderRadius: 10 }}>
      <p style={{ fontSize: 13.5, margin: "0 0 10px", lineHeight: 1.5 }}>{flareRuleText}</p>
      <div style={{ background: "var(--crimson-light)", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, color: "var(--crimson-dark)", marginBottom: 10, lineHeight: 1.5 }}>
        If the pain is severe, constant, or you notice new symptoms such as numbness, tingling or weakness, contact
        David directly or call NHS 111. In an emergency, call 999.
      </div>
      <button type="button" className={styles.doneButton} disabled={submitting} onClick={repeat}>
        {submitting ? "…" : "Repeat this week"}
      </button>
    </div>
  );
}

function SessionCard({
  importedPlanId,
  session,
  weekNumber,
  logInfo,
  onLogged,
  onRepeat,
  flareRuleText,
}: {
  importedPlanId: string;
  session: PlanSession;
  weekNumber: number;
  logInfo: LogInfo | undefined;
  onLogged: () => void;
  onRepeat: () => void;
  flareRuleText: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const isDone = Boolean(logInfo?.completed_quality);

  if (!expanded) {
    return (
      <button type="button" className={styles.row} onClick={() => setExpanded(true)}>
        <div className={styles.thumb}>
          <div className={styles.mini} />
        </div>
        <div className={styles.rmeta}>
          <div className={styles.rn}>
            <TypeBadge type={session.type} />
            {session.title}
          </div>
          <div className={styles.rd}>
            {session.summary}
            {session.day !== "any" && DAY_LABEL[session.day] ? ` · ${DAY_LABEL[session.day]}` : ""}
          </div>
        </div>
        <div className={styles.chevr}>&rsaquo;</div>
      </button>
    );
  }

  if (session.type === "strength") {
    return (
      <div className={styles.card}>
        <div className={styles.xname}>
          <TypeBadge type={session.type} />
          {session.title}
        </div>
        <p className={styles.cardioPlain}>Your strength session. Open it in your normal programme.</p>
        <Link href="/session" className={styles.doneButton} style={{ display: "inline-block", textDecoration: "none", textAlign: "center" }}>
          Open your strength session
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.xname}>
        <TypeBadge type={session.type} />
        {session.title}
      </div>
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
            Notes <span className={styles.chev}>&#8964;</span>
          </summary>
          <div className={styles.why}>{session.notes}</div>
        </details>
      )}

      {isDone ? (
        <button type="button" className={`${styles.doneButton} ${styles.isDone}`} disabled>
          Done ✓
        </button>
      ) : (
        <SessionCompleteForm importedPlanId={importedPlanId} session={session} onDone={onLogged} />
      )}

      {session.type === "run" && <FlareBox importedPlanId={importedPlanId} weekNumber={weekNumber} flareRuleText={flareRuleText} onRepeat={onRepeat} />}
    </div>
  );
}

export default function PlanWeekView({
  importedPlanId,
  blockTitle,
  intro,
  week,
  currentWeekNumber,
  totalWeeks,
  prevWeek,
  nextWeek,
  isFirstWeek,
  flareRuleText,
  moveOnText,
  logs,
}: Props) {
  const [localLogs, setLocalLogs] = useState<LogInfo[]>(logs);
  const [repeated, setRepeated] = useState(false);
  const [repeating, setRepeating] = useState(false);
  const logBySessionId = new Map(localLogs.map((l) => [l.session_id, l]));

  function refreshLogs() {
    // Best-effort local reflect -- a full reload picks up the real state
    // next time /plan is visited; this just flips the button state now.
    window.location.reload();
  }

  async function repeatWeek() {
    setRepeating(true);
    try {
      await fetch("/api/plan/repeat-week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imported_plan_id: importedPlanId, week_number: currentWeekNumber, kind: "repeat_week" }),
      });
      setRepeated(true);
    } finally {
      setRepeating(false);
    }
  }

  const sortedSessions = [...week.sessions].sort((a, b) => a.order - b.order);

  return (
    <>
      <div style={{ padding: "18px 22px 0" }}>
        <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>{blockTitle}</h1>
        <div style={{ fontSize: 14, color: "var(--muted)", marginBottom: 4 }}>
          Week {currentWeekNumber} of {totalWeeks}
        </div>
        {week.focus && <div style={{ fontSize: 14.5, marginBottom: 4 }}>{week.focus}</div>}
        {week.label && <div style={{ fontSize: 13, color: "var(--muted)" }}>{week.label}</div>}
        <a
          href="/api/plan/pdf"
          style={{ display: "inline-block", marginTop: 10, fontSize: 13, color: "var(--crimson)", textDecoration: "none" }}
        >
          Download my plan (PDF)
        </a>
      </div>

      {isFirstWeek && intro && (
        <div className={styles.messageCard} style={{ margin: "14px 22px" }}>
          <p style={{ fontSize: 14, margin: 0 }}>{intro}</p>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 22px" }}>
        {prevWeek ? (
          <Link href={`/plan?week=${prevWeek}`} style={{ fontSize: 14, color: "var(--crimson)" }}>
            &larr; Week {prevWeek}
          </Link>
        ) : (
          <span />
        )}
        {nextWeek ? (
          <Link href={`/plan?week=${nextWeek}`} style={{ fontSize: 14, color: "var(--crimson)" }}>
            Week {nextWeek} &rarr;
          </Link>
        ) : (
          <span />
        )}
      </div>

      <div className={styles.list}>
        {sortedSessions.map((session) => (
          <SessionCard
            key={session.id}
            importedPlanId={importedPlanId}
            session={session}
            weekNumber={currentWeekNumber}
            logInfo={logBySessionId.get(session.id)}
            onLogged={refreshLogs}
            onRepeat={refreshLogs}
            flareRuleText={flareRuleText}
          />
        ))}
      </div>

      <div style={{ margin: "20px 22px" }}>
        {repeated ? (
          <p style={{ fontSize: 13, color: "var(--stone)" }}>This week will repeat, and David has been told.</p>
        ) : (
          <>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>{moveOnText}</p>
            <button
              type="button"
              style={{ border: "1px solid var(--stone)", background: "#fff", color: "var(--graphite)", borderRadius: 10, padding: "9px 16px", fontSize: 13.5 }}
              disabled={repeating}
              onClick={repeatWeek}
            >
              {repeating ? "…" : "Repeat this week"}
            </button>
          </>
        )}
      </div>
    </>
  );
}
