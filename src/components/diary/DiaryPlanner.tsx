"use client";

import { useState } from "react";
import styles from "./DiaryPlanner.module.css";
import { SLOT_LENGTHS, SLOT_LOCATIONS, formatSlotWhen, locationLabel, utcToLondonFields, type SlotSummary } from "@/lib/diary";
import type { PlannerData, PlannerSession, PlannerWeek } from "@/lib/diaryServer";

// The planner itself, used by the client in their own app and by a PA
// through their planner link. Each session in this week and next gets a
// day, a time, a length and a place; saving puts it in the client's
// Athena Training calendar in Google, when that is linked.

const dayLabel = (key: string) =>
  new Date(`${key}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

function daysBetween(first: string, last: string): string[] {
  const out: string[] = [];
  const d = new Date(`${first}T12:00:00Z`);
  const end = new Date(`${last}T12:00:00Z`);
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export default function DiaryPlanner({ initial, endpoint }: { initial: PlannerData; endpoint: string }) {
  const [weeks, setWeeks] = useState<PlannerWeek[]>(initial.weeks);

  function setSlot(programmeId: string, programmeWorkoutId: string, weekNumber: number, slot: SlotSummary | null) {
    setWeeks((prev) =>
      prev.map((w) =>
        w.programmeId !== programmeId || w.weekNumber !== weekNumber
          ? w
          : { ...w, sessions: w.sessions.map((s) => (s.programmeWorkoutId === programmeWorkoutId ? { ...s, slot } : s)) },
      ),
    );
  }

  if (weeks.length === 0) {
    return <p className={styles.quiet}>There are no sessions to place this week or next. Once a new block starts, they will appear here.</p>;
  }

  return (
    <div className={styles.planner}>
      {weeks.map((w) => {
        const placed = w.sessions.filter((s) => s.slot).length;
        return (
          <section key={`${w.programmeId}:${w.weekNumber}`} className={styles.week}>
            <h2 className={styles.weekTitle}>
              {w.programmeTitle}, week {w.weekNumber}
            </h2>
            <p className={styles.weekDates}>
              {dayLabel(w.firstDate)} to {dayLabel(w.lastDate)}. {placed} of {w.sessions.length} placed.
            </p>
            {w.sessions.map((s) => (
              <SessionRow
                key={s.programmeWorkoutId}
                week={w}
                session={s}
                endpoint={endpoint}
                googleConnected={initial.google.connected}
                onSaved={(slot) => setSlot(w.programmeId, s.programmeWorkoutId, w.weekNumber, slot)}
              />
            ))}
          </section>
        );
      })}
      <p className={styles.quiet}>All times are UK time.</p>
    </div>
  );
}

function SessionRow({
  week,
  session,
  endpoint,
  googleConnected,
  onSaved,
}: {
  week: PlannerWeek;
  session: PlannerSession;
  endpoint: string;
  googleConnected: boolean;
  onSaved: (slot: SlotSummary | null) => void;
}) {
  const existing = session.slot ? utcToLondonFields(session.slot.startsAt) : null;
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(existing?.date ?? session.fixedDate ?? week.firstDate);
  const [time, setTime] = useState(existing?.time ?? "07:00");
  const [duration, setDuration] = useState<number>(session.slot?.durationMinutes ?? 45);
  const [location, setLocation] = useState<string>(session.slot?.location ?? "home");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const days = session.fixedDate ? [session.fixedDate] : daysBetween(week.firstDate, week.lastDate);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programmeWorkoutId: session.programmeWorkoutId,
          weekNumber: week.weekNumber,
          date,
          time,
          durationMinutes: duration,
          location,
        }),
      });
      const data = (await res.json()) as { slot?: SlotSummary; error?: string };
      if (!res.ok || !data.slot) throw new Error(data.error ?? "The slot couldn't be saved.");
      onSaved(data.slot);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The slot couldn't be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!session.slot) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId: session.slot.id }),
      });
      if (!res.ok) throw new Error("The slot couldn't be removed.");
      onSaved(null);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The slot couldn't be removed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.session}>
      <div className={styles.sessionHead}>
        <span className={styles.sessionName}>{session.label}</span>
        {!editing && (
          <button type="button" className={styles.link} onClick={() => setEditing(true)}>
            {session.slot ? "Change" : "Place"}
          </button>
        )}
      </div>

      {session.slot ? (
        <>
          <p className={styles.placed}>
            {formatSlotWhen(session.slot.startsAt)}, {session.slot.durationMinutes} minutes, {locationLabel(session.slot.location).toLowerCase()}.
          </p>
          {googleConnected && (
            <p className={styles.quiet}>
              {session.slot.googleSynced
                ? "In the Athena Training calendar."
                : session.slot.googleError
                  ? "Saved here, but Google Calendar didn't accept it just now. Saving again usually sorts it."
                  : "Saved here."}
            </p>
          )}
        </>
      ) : (
        <p className={styles.quiet}>
          {session.fixedDate ? `Set for ${dayLabel(session.fixedDate)}. Choose a time.` : "Any day this week. Not placed yet."}
        </p>
      )}

      {editing && (
        <div className={styles.form}>
          <label>
            Day
            <select value={date} onChange={(e) => setDate(e.target.value)} disabled={days.length === 1}>
              {days.map((d) => (
                <option key={d} value={d}>
                  {dayLabel(d)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Start time
            <input type="time" value={time} step={300} onChange={(e) => setTime(e.target.value)} />
          </label>
          <label>
            Time available
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {SLOT_LENGTHS.map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </select>
          </label>
          <label>
            Where
            <select value={location} onChange={(e) => setLocation(e.target.value)}>
              {SLOT_LOCATIONS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={save} disabled={busy}>
              {busy ? "Saving" : "Save"}
            </button>
            <button type="button" className={styles.secondary} onClick={() => setEditing(false)} disabled={busy}>
              Cancel
            </button>
            {session.slot && (
              <button type="button" className={styles.secondary} onClick={remove} disabled={busy}>
                Remove slot
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
