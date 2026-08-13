"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DayStatus } from "@/lib/patientEngagement";
import styles from "./PatientDashboard.module.css";

const DAY_ABBR = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export type TodayCard = {
  title: string;
  exerciseCount: number;
  durationSeconds: number | null;
  alreadyDone: boolean;
};

export type MissedSession = { week: number; dayOfWeek: number; workoutName: string };

export type WeekDaySlot =
  | { dayOfWeek: number; scheduled: false }
  | { dayOfWeek: number; scheduled: true; workoutName: string; status: DayStatus };

export type ProgrammeSession = { week: number; dayOfWeek: number; workoutName: string; status: DayStatus; dateLabel: string };
export type ProgrammePhaseInfo = { name: string; startWeek: number; endWeek: number; status: "done" | "current" | "upcoming" };

type Props = {
  programmeId: string;
  title: string;
  week: number;
  blockLengthWeeks: number;
  todayDayOfWeek: number;
  todayCard: TodayCard | null;
  missedSessions: MissedSession[];
  weekDays: WeekDaySlot[];
  wholeProgramme: ProgrammeSession[];
  totalSessions: number;
  completedSessions: number;
  missedCount: number;
  phases: ProgrammePhaseInfo[];
};

function formatDuration(seconds: number | null): string | null {
  if (!seconds) return null;
  const minutes = Math.round(seconds / 60);
  return `est. ${minutes} min`;
}

function statusLabel(status: DayStatus): string {
  switch (status) {
    case "done":
      return "Done";
    case "skipped":
      return "Skipped";
    case "missed":
      return "Missed";
    case "today":
      return "Today";
    case "upcoming":
      return "Upcoming";
  }
}

function statusClass(status: DayStatus): string {
  switch (status) {
    case "done":
      return styles.statusDone;
    case "skipped":
      return styles.statusSkipped;
    case "missed":
      return styles.statusMissed;
    case "today":
      return styles.statusToday;
    case "upcoming":
      return styles.statusUpcoming;
  }
}

function chipClass(status: DayStatus): string {
  switch (status) {
    case "done":
      return styles.dayChipDone;
    case "skipped":
      return styles.dayChipSkipped;
    case "missed":
      return styles.dayChipMissed;
    case "today":
      return styles.dayChipToday;
    case "upcoming":
      return "";
  }
}

function chipSymbol(status: DayStatus): string {
  switch (status) {
    case "done":
      return "✓";
    case "skipped":
      return "-";
    case "missed":
      return "!";
    case "today":
      return "●";
    case "upcoming":
      return "·";
  }
}

export default function PatientDashboard({
  programmeId,
  title,
  week,
  blockLengthWeeks,
  todayDayOfWeek,
  todayCard,
  missedSessions,
  weekDays,
  wholeProgramme,
  totalSessions,
  completedSessions,
  missedCount,
  phases,
}: Props) {
  const router = useRouter();
  const [weekOpen, setWeekOpen] = useState(true);
  const [programmeOpen, setProgrammeOpen] = useState(false);
  const [skipping, setSkipping] = useState<string | null>(null);

  async function skipSession(targetWeek: number, targetDay: number) {
    const key = `${targetWeek}:${targetDay}`;
    setSkipping(key);
    try {
      await fetch("/api/session/skip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programme_id: programmeId, week_number: targetWeek, day_of_week: targetDay, skipped: true }),
      });
      router.refresh();
    } finally {
      setSkipping(null);
    }
  }

  const progressPercent = Math.round((week / blockLengthWeeks) * 100);
  const durationLabel = todayCard ? formatDuration(todayCard.durationSeconds) : null;

  const weeksWithSessions = Array.from(new Set(wholeProgramme.map((s) => s.week))).sort((a, b) => a - b);

  return (
    <div className={styles.page}>
      <div>
        <div className={styles.sub}>{title}</div>
        <div className={styles.progressPill}>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
          </div>
          <div className={styles.progressLabel}>
            Week {week} of {blockLengthWeeks}
          </div>
        </div>
      </div>

      {/* TODAY'S SESSION */}
      {todayCard && (
        <div className={`${styles.card} ${styles.todayCard}`}>
          <div className={styles.todayThumb} />
          <div className={styles.todayBody}>
            <div className={styles.todayLabel}>{todayCard.alreadyDone ? "Today, already underway" : "Recommended today"}</div>
            <div className={styles.todayTitle}>{todayCard.title}</div>
            <div className={styles.todayMeta}>
              {durationLabel && <span>⏱ {durationLabel}</span>}
              <span>
                🏋 {todayCard.exerciseCount} exercise{todayCard.exerciseCount === 1 ? "" : "s"}
              </span>
            </div>
            <div className={styles.todayActions}>
              <Link href={`/session/${programmeId}`} className={`${styles.btn} ${styles.btnPrimary}`}>
                {todayCard.alreadyDone ? "Continue session" : "Start session"}
              </Link>
              {!todayCard.alreadyDone && (
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnGhostDark}`}
                  disabled={skipping === `${week}:${todayDayOfWeek}`}
                  onClick={() => skipSession(week, todayDayOfWeek)}
                >
                  Skip today
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MISSED SESSIONS -- one card per session, never merged */}
      {missedSessions.map((m) => (
        <div key={`${m.week}:${m.dayOfWeek}`} className={`${styles.card} ${styles.missedCard}`}>
          <div className={styles.missedLeft}>
            <div className={styles.missedIcon}>!</div>
            <div>
              <div className={styles.missedTitle}>You missed {DAY_LABELS[m.dayOfWeek - 1]}&apos;s session</div>
              <div className={styles.missedSub}>{m.workoutName}</div>
            </div>
          </div>
          <div className={styles.missedActions}>
            <Link href={`/session/${programmeId}?week=${m.week}&day=${m.dayOfWeek}`} className={`${styles.btnSm} ${styles.btnSmPrimary}`}>
              Do it now
            </Link>
            <button
              type="button"
              className={styles.btnSm}
              disabled={skipping === `${m.week}:${m.dayOfWeek}`}
              onClick={() => skipSession(m.week, m.dayOfWeek)}
            >
              Skip
            </button>
          </div>
        </div>
      ))}

      {/* THIS WEEK */}
      <div className={styles.card}>
        <button type="button" className={styles.boxHead} onClick={() => setWeekOpen((v) => !v)}>
          <h3>This week</h3>
          <span className={styles.chevron}>{weekOpen ? "▾" : "▸"}</span>
        </button>

        <div className={styles.weekStrip}>
          {weekDays.map((d) => (
            <button
              key={d.dayOfWeek}
              type="button"
              disabled={!d.scheduled}
              className={`${styles.dayChip} ${d.scheduled ? chipClass(d.status) : ""}`}
              onClick={() => {
                if (d.scheduled) router.push(`/session/${programmeId}?week=${week}&day=${d.dayOfWeek}`);
              }}
            >
              <span className={styles.dayChipLabel}>{DAY_ABBR[d.dayOfWeek - 1]}</span>
              {d.scheduled ? chipSymbol(d.status) : "·"}
            </button>
          ))}
        </div>

        {weekOpen && (
          <div className={styles.sessionList}>
            {weekDays
              .filter((d): d is Extract<WeekDaySlot, { scheduled: true }> => d.scheduled)
              .map((d) => (
                <Link
                  key={d.dayOfWeek}
                  href={`/session/${programmeId}?week=${week}&day=${d.dayOfWeek}`}
                  className={styles.sessionRow}
                >
                  <div>
                    <div className={styles.sessionRowName}>{d.workoutName}</div>
                    <div className={styles.sessionRowDate}>
                      {d.dayOfWeek === todayDayOfWeek ? "Today" : DAY_LABELS[d.dayOfWeek - 1]}
                    </div>
                  </div>
                  <span className={`${styles.status} ${statusClass(d.status)}`}>{statusLabel(d.status)}</span>
                </Link>
              ))}
          </div>
        )}
      </div>

      {/* WHOLE PROGRAMME */}
      <div className={styles.card}>
        <button type="button" className={styles.boxHead} onClick={() => setProgrammeOpen((v) => !v)}>
          <h3>Whole programme</h3>
          <span className={styles.chevron}>{programmeOpen ? "▾" : "▸"}</span>
        </button>
        <div className={styles.programmeSummary}>
          {completedSessions} of {totalSessions} sessions complete
          {missedCount > 0 && ` · ${missedCount} missed`} · Week {week} of {blockLengthWeeks}
        </div>

        {phases.length > 0 && (
          <div className={styles.phaseRow}>
            {phases.map((p) => (
              <div
                key={p.name}
                className={`${styles.phasePill} ${p.status === "current" ? styles.phasePillCurrent : p.status === "done" ? styles.phasePillDone : ""}`}
                title={`Weeks ${p.startWeek}-${p.endWeek}`}
              >
                {p.name}
              </div>
            ))}
          </div>
        )}

        {programmeOpen && (
          <div>
            {weeksWithSessions.map((w) => (
              <div key={w} className={styles.weekGroup}>
                <div className={styles.weekGroupLabel}>Week {w}</div>
                <div className={styles.sessionList}>
                  {wholeProgramme
                    .filter((s) => s.week === w)
                    .map((s) => (
                      <Link
                        key={`${s.week}:${s.dayOfWeek}`}
                        href={`/session/${programmeId}?week=${s.week}&day=${s.dayOfWeek}`}
                        className={styles.sessionRow}
                      >
                        <div>
                          <div className={styles.sessionRowName}>{s.workoutName}</div>
                          <div className={styles.sessionRowDate}>{s.dateLabel}</div>
                        </div>
                        <span className={`${styles.status} ${statusClass(s.status)}`}>{statusLabel(s.status)}</span>
                      </Link>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
