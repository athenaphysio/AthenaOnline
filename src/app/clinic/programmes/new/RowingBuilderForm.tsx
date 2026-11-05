"use client";

import { useMemo, useState } from "react";
import PatientPicker, { type Patient } from "../../PatientPicker";
import clinicStyles from "../../clinic.module.css";
import choiceStyles from "./NewProgrammeChoice.module.css";
import styles from "./RowingBuilder.module.css";
import type { WorkoutAssignment } from "../ProgrammeBuilder";
import {
  buildRowingPlan,
  mondayOnOrBefore,
  type DayMode,
  type RowingDay,
  type RowingEventKind,
  type RowingInputs,
  type StrengthPhase,
} from "@/lib/rowing/rowingPlan";
import {
  DEFAULT_ZONE_OFFSETS,
  SPORT_TEXT,
  ZONE_INFO,
  bandText,
  formatDuration,
  formatSplit,
  parseDuration,
  referenceFromTest,
  splitFromTwentyMinutes,
  zoneBand,
  type Sport,
  type ZoneOffsets,
} from "@/lib/rowing/zones";

export type StrengthSet = Record<StrengthPhase, { id: string; name: string } | null>;
export type RowingStrengthWorkouts = Record<Sport, StrengthSet>;

export type RowingBuilderOutput = {
  patient: Patient | null;
  title: string;
  weeks: number;
  startDate: string;
  intro: string;
  rules: { move_on: string; flare: string };
  weekLabels: Record<number, string>;
  assignments: WorkoutAssignment[];
  notice: string | null;
};

type Props = {
  programmeId: string;
  initialPatient: Patient | null;
  strengthWorkouts: RowingStrengthWorkouts;
  onBack: () => void;
  onOpen: (out: RowingBuilderOutput) => void;
};

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const EVENT_LABELS: Record<RowingEventKind, string> = {
  "5k": "5K",
  "10k": "10K",
  half_marathon: "Half marathon (21,097m)",
  marathon: "Marathon (42,195m)",
  custom_distance: "Another distance",
  custom_time: "A timed event",
};

const EVENT_NAMES: Record<Sport, Partial<Record<RowingEventKind, string>>> = {
  row: { "5k": "5K row", "10k": "10K row", half_marathon: "Half marathon row", marathon: "Marathon row" },
  run: { "5k": "5K", "10k": "10K", half_marathon: "Half marathon", marathon: "Marathon" },
};

const TEST_DISTANCES = [
  { value: "5000", label: "5K" },
  { value: "10000", label: "10K" },
  { value: "21097", label: "Half marathon" },
  { value: "other", label: "Another distance" },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

let keyCounter = 0;
function newKey(): string {
  keyCounter += 1;
  return `row-${Date.now()}-${keyCounter}`;
}

export default function RowingBuilderForm({ programmeId, initialPatient, strengthWorkouts, onBack, onOpen }: Props) {
  const [patient, setPatient] = useState<Patient | null>(initialPatient);
  const [sport, setSport] = useState<Sport>("row");
  const [goalText, setGoalText] = useState("");
  const [runTestChoice, setRunTestChoice] = useState("5000");
  const [runTestOther, setRunTestOther] = useState("");
  const [runTestTime, setRunTestTime] = useState("");
  const [eventKind, setEventKind] = useState<RowingEventKind>("half_marathon");
  const [eventName, setEventName] = useState("Half marathon row");
  const [eventDistance, setEventDistance] = useState("");
  const [eventMinutes, setEventMinutes] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [startDate, setStartDate] = useState(todayIso());
  const [testDistance, setTestDistance] = useState("");
  const [testDate, setTestDate] = useState(todayIso());
  const [longest, setLongest] = useState("30");
  const [days, setDays] = useState<RowingDay[]>(
    DAY_NAMES.map((_, i) => ({ day: i + 1, mode: "none" as DayMode, minutes: 45 }))
  );
  const [offsets, setOffsets] = useState<ZoneOffsets>(DEFAULT_ZONE_OFFSETS.row);
  const [showZones, setShowZones] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goalSeconds = parseDuration(goalText);
  const runTestDistance = runTestChoice === "other" ? Number(runTestOther) : Number(runTestChoice);
  const runTestSeconds = parseDuration(runTestTime);

  const inputs: RowingInputs = useMemo(
    () => ({
      sport,
      goalTimeSeconds: goalText.trim() ? (goalSeconds ?? -1) : null,
      testTimeSeconds: sport === "run" ? runTestSeconds : null,
      clientFirstName: patient?.first_name ?? "",
      startDate,
      eventDate,
      eventKind,
      eventName,
      eventDistanceM: eventKind === "custom_distance" ? Number(eventDistance) : null,
      eventMinutes: eventKind === "custom_time" ? Number(eventMinutes) : null,
      testDistanceM: sport === "row" ? Number(testDistance) : runTestDistance,
      testDate,
      longestRowMinutes: Number(longest),
      days,
      zoneOffsets: offsets,
    }),
    [sport, goalText, goalSeconds, runTestSeconds, runTestDistance, patient, startDate, eventDate, eventKind, eventName, eventDistance, eventMinutes, testDistance, testDate, longest, days, offsets]
  );

  const result = useMemo(() => buildRowingPlan(inputs), [inputs]);
  const testSplit =
    sport === "row"
      ? Number(testDistance) > 0
        ? splitFromTwentyMinutes(Number(testDistance))
        : null
      : runTestDistance > 0 && runTestSeconds
        ? referenceFromTest("run", runTestDistance, runTestSeconds)
        : null;
  const unit = SPORT_TEXT[sport].unit;
  const strength = strengthWorkouts[sport];

  function setDay(day: number, patch: Partial<RowingDay>) {
    setDays((prev) => prev.map((d) => (d.day === day ? { ...d, ...patch } : d)));
  }

  function setOffset(zone: keyof ZoneOffsets, edge: 0 | 1, value: string) {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    setOffsets((prev) => {
      const pair: [number, number] = [...prev[zone]] as [number, number];
      pair[edge] = n;
      return { ...prev, [zone]: pair };
    });
  }

  function chooseEvent(kind: RowingEventKind, forSport: Sport = sport) {
    setEventKind(kind);
    setEventName(EVENT_NAMES[forSport][kind] ?? "");
  }

  function chooseSport(next: Sport) {
    setSport(next);
    setOffsets(DEFAULT_ZONE_OFFSETS[next]);
    const kind = next === "run" && eventKind === "custom_time" ? "half_marathon" : eventKind;
    chooseEvent(kind, next);
  }

  async function open() {
    if (!result.ok) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/clinic/rowing/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programme_id: programmeId, patient_id: patient?.id ?? null, inputs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save the plan.");

      const rowCards: WorkoutAssignment[] = result.cards.map((c) => ({
        key: newKey(),
        workout_id: crypto.randomUUID(),
        workout_name: c.plan.title,
        high_load: false,
        days: [c.day],
        week: c.week,
        plan: c.plan,
        dayNotSet: false,
        order: c.order,
      }));
      const missing = new Set<StrengthPhase>();
      const strengthCards: WorkoutAssignment[] = [];
      for (const s of result.strength) {
        const w = strength[s.phase];
        if (!w) {
          missing.add(s.phase);
          continue;
        }
        strengthCards.push({
          key: newKey(),
          workout_id: w.id,
          workout_name: w.name,
          high_load: false,
          days: [s.day],
          week: s.week,
          order: 10,
          kind: "standard",
        });
      }
      onOpen({
        patient,
        title: result.title,
        weeks: result.summary.totalWeeks,
        startDate: result.mondayStart,
        intro: result.intro,
        rules: result.rules,
        weekLabels: result.weekLabels,
        assignments: [...rowCards, ...strengthCards],
        notice: missing.size
          ? "One or more of the strength sessions could not be found in the library, so those days were left empty."
          : null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the plan.");
      setSaving(false);
    }
  }

  const s = result.ok ? result.summary : null;

  return (
    <div>
      <button type="button" className={choiceStyles.backLink} onClick={onBack}>
        ← Back
      </button>

      <div className={clinicStyles.card}>
        <h2 className={clinicStyles.cardTitle}>Who and what for</h2>
        <div className={styles.buttons} style={{ marginTop: 0, marginBottom: 14 }}>
          {(["row", "run"] as const).map((sp) => (
            <button
              key={sp}
              type="button"
              className={sport === sp ? clinicStyles.button : clinicStyles.buttonSecondary}
              style={{ height: 38 }}
              aria-pressed={sport === sp}
              onClick={() => chooseSport(sp)}
            >
              {sp === "row" ? "Rowing" : "Running"}
            </button>
          ))}
        </div>
        <PatientPicker selected={patient} onSelect={setPatient} />
        <div className={styles.grid2}>
          <div className={clinicStyles.field}>
            <label className={clinicStyles.label}>Event</label>
            <select className={clinicStyles.input} value={eventKind} onChange={(e) => chooseEvent(e.target.value as RowingEventKind)}>
              {(Object.keys(EVENT_LABELS) as RowingEventKind[]).filter((k) => sport === "row" || k !== "custom_time").map((k) => (
                <option key={k} value={k}>
                  {EVENT_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div className={clinicStyles.field}>
            <label className={clinicStyles.label}>Name the client will see</label>
            <input className={clinicStyles.input} value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder={sport === "row" ? "Charity 50K row" : "Brighton Marathon"} />
          </div>
        </div>
        <div className={styles.grid3}>
          {eventKind === "custom_distance" && (
            <div className={clinicStyles.field}>
              <label className={clinicStyles.label}>Distance (metres)</label>
              <input className={clinicStyles.input} inputMode="numeric" value={eventDistance} onChange={(e) => setEventDistance(e.target.value)} />
            </div>
          )}
          {eventKind === "custom_time" && (
            <div className={clinicStyles.field}>
              <label className={clinicStyles.label}>Length (minutes)</label>
              <input className={clinicStyles.input} inputMode="numeric" value={eventMinutes} onChange={(e) => setEventMinutes(e.target.value)} />
            </div>
          )}
          {eventKind !== "custom_time" && (
            <div className={clinicStyles.field}>
              <label className={clinicStyles.label}>Goal time (optional)</label>
              <input className={clinicStyles.input} value={goalText} onChange={(e) => setGoalText(e.target.value)} placeholder={sport === "row" ? "1:35:00" : "3:30:00"} />
              <p className={styles.hint}>Hours, minutes and seconds, such as 3:30:00 or 45:00. Leave empty to train for the event without a set time.</p>
            </div>
          )}
          <div className={clinicStyles.field}>
            <label className={clinicStyles.label}>Event date</label>
            <input type="date" className={clinicStyles.input} value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          </div>
          <div className={clinicStyles.field}>
            <label className={clinicStyles.label}>Start the plan</label>
            <input type="date" className={clinicStyles.input} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            {startDate && mondayOnOrBefore(startDate) !== startDate && (
              <p className={styles.hint}>Weeks run Monday to Sunday, so week 1 begins on {mondayOnOrBefore(startDate)} with the days before your start left empty.</p>
            )}
          </div>
        </div>
      </div>

      <div className={clinicStyles.card}>
        <h2 className={clinicStyles.cardTitle}>Where they start</h2>
        <div className={styles.grid3}>
          {sport === "row" ? (
            <div className={clinicStyles.field}>
              <label className={clinicStyles.label}>20 minute test distance (metres)</label>
              <input className={clinicStyles.input} inputMode="numeric" value={testDistance} onChange={(e) => setTestDistance(e.target.value)} placeholder="4800" />
              {testSplit != null && <p className={styles.hint}>An average of {formatSplit(testSplit)} per 500m.</p>}
            </div>
          ) : (
            <>
              <div className={clinicStyles.field}>
                <label className={clinicStyles.label}>Time trial or recent race</label>
                <select className={clinicStyles.input} value={runTestChoice} onChange={(e) => setRunTestChoice(e.target.value)}>
                  {TEST_DISTANCES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                {runTestChoice === "other" && (
                  <input className={clinicStyles.input} style={{ marginTop: 6 }} inputMode="numeric" value={runTestOther} onChange={(e) => setRunTestOther(e.target.value)} placeholder="Metres" />
                )}
              </div>
              <div className={clinicStyles.field}>
                <label className={clinicStyles.label}>Their time</label>
                <input className={clinicStyles.input} value={runTestTime} onChange={(e) => setRunTestTime(e.target.value)} placeholder="25:30" />
                {testSplit != null && <p className={styles.hint}>A 5K pace of about {formatSplit(testSplit)} per km.</p>}
              </div>
            </>
          )}
          <div className={clinicStyles.field}>
            <label className={clinicStyles.label}>Test date</label>
            <input type="date" className={clinicStyles.input} value={testDate} onChange={(e) => setTestDate(e.target.value)} />
          </div>
          <div className={clinicStyles.field}>
            <label className={clinicStyles.label}>Longest comfortable {SPORT_TEXT[sport].noun} now (minutes)</label>
            <input className={clinicStyles.input} inputMode="numeric" value={longest} onChange={(e) => setLongest(e.target.value)} />
          </div>
        </div>
      </div>

      <div className={clinicStyles.card}>
        <h2 className={clinicStyles.cardTitle}>Their week</h2>
        <p className={styles.hint} style={{ marginBottom: 12 }}>
          For each day, what they can do and how many minutes they have in total. A day marked {SPORT_TEXT[sport].noun} and strength keeps 40 minutes of it for strength.
        </p>
        {days.map((d) => (
          <div key={d.day} className={styles.dayRow}>
            <span className={styles.dayName}>{DAY_NAMES[d.day - 1]}</span>
            <select className={clinicStyles.input} value={d.mode} onChange={(e) => setDay(d.day, { mode: e.target.value as DayMode })}>
              <option value="none">Not available</option>
              <option value="row">{sport === "row" ? "Row" : "Run"}</option>
              <option value="strength">Strength</option>
              <option value="both">{sport === "row" ? "Row" : "Run"} and strength</option>
            </select>
            <input
              className={clinicStyles.input}
              inputMode="numeric"
              aria-label={`${DAY_NAMES[d.day - 1]} minutes`}
              value={d.mode === "none" ? "" : String(d.minutes)}
              disabled={d.mode === "none"}
              onChange={(e) => setDay(d.day, { minutes: Number(e.target.value) || 0 })}
              placeholder="min"
            />
          </div>
        ))}
      </div>

      <div className={clinicStyles.card}>
        <h2 className={clinicStyles.cardTitle}>Training zones</h2>
        <p className={styles.hint}>
          {sport === "row"
            ? "Each zone is a range of seconds per 500m either side of the 20 minute test split."
            : "Each zone is a range of seconds per km either side of the client's 5K pace."}{" "}
          These are draft starting values for you to check, and you can change them for this client.
        </p>
        <button type="button" className={clinicStyles.buttonSecondary} style={{ marginTop: 10, height: 38 }} onClick={() => setShowZones((v) => !v)}>
          {showZones ? "Hide zones" : "Show and adjust zones"}
        </button>
        {showZones && (
          <table className={styles.table} style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Zone</th>
                <th>Seconds from {sport === "row" ? "test split" : "5K pace"}</th>
                <th>Pace for this client</th>
                {sport === "row" && <th>Rate</th>}
              </tr>
            </thead>
            <tbody>
              {(["UT2", "UT1", "AT", "TR"] as const).map((z) => (
                <tr key={z}>
                  <td>
                    {ZONE_INFO[sport][z].name}
                  </td>
                  <td>
                    <input className={styles.offsetInput} value={offsets[z][0]} onChange={(e) => setOffset(z, 0, e.target.value)} aria-label={`${z} fast edge`} /> to{" "}
                    <input className={styles.offsetInput} value={offsets[z][1]} onChange={(e) => setOffset(z, 1, e.target.value)} aria-label={`${z} slow edge`} />
                  </td>
                  <td>{testSplit != null ? bandText(sport, zoneBand(testSplit, z, offsets)) : "Add the test first"}</td>
                  {sport === "row" && <td>{ZONE_INFO[sport][z].rate}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!result.ok && (
        <div className={clinicStyles.warningCard}>
          <div className={clinicStyles.warningTitle}>Still needed before the plan can be built</div>
          {result.errors.map((e) => (
            <div key={e} className={clinicStyles.warningItem}>
              {e}
            </div>
          ))}
        </div>
      )}

      {result.ok && s && (
        <>
          {s.goal && (
            <div className={clinicStyles.card}>
              <h2 className={clinicStyles.cardTitle}>The goal: {s.goal.headline}</h2>
              <div className={styles.stat}>
                <div className={styles.statItem}>
                  <div className={styles.statValue}>{formatDuration(s.goal.predictedSeconds)}</div>
                  <div className={styles.statLabel}>Predicted from today&apos;s test</div>
                </div>
                <div className={styles.statItem}>
                  <div className={styles.statValue}>{formatDuration(s.goal.goalSeconds)}</div>
                  <div className={styles.statLabel}>Goal, {formatSplit(s.eventSplit)} {unit}</div>
                </div>
                <div className={styles.statItem}>
                  <div className={styles.statValue}>{s.goal.gap > 0 ? `${(s.goal.gap * 100).toFixed(1)}%` : "None"}</div>
                  <div className={styles.statLabel}>Improvement needed over {s.goal.weeks} weeks</div>
                </div>
                <div className={styles.statItem}>
                  <div className={styles.statValue}>{formatDuration(s.goal.realisticSeconds)}</div>
                  <div className={styles.statLabel}>Comfortable target by that date</div>
                </div>
              </div>
              <p className={styles.hint} style={{ fontSize: 13.5 }}>{s.goal.detail}</p>
              <p className={styles.hint}>
                The verdict uses draft improvement rates for you to check. Retests are planned in week{s.testWeeks.length === 1 ? "" : "s"}{" "}
                {s.testWeeks.length ? s.testWeeks.join(" and ") : "none (the plan is short)"}.
              </p>
            </div>
          )}
          <div className={clinicStyles.card}>
            <h2 className={clinicStyles.cardTitle}>The plan</h2>
            <div className={styles.stat}>
              <div className={styles.statItem}>
                <div className={styles.statValue}>{s.totalWeeks} weeks</div>
                <div className={styles.statLabel}>{s.phases.map((p) => `${p.name} ${p.fromWeek === p.toWeek ? p.fromWeek : `${p.fromWeek} to ${p.toWeek}`}`).join(", ")}</div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statValue}>
                  {s.longStart} to {s.longPeak} min
                </div>
                <div className={styles.statLabel}>Long {SPORT_TEXT[sport].noun}, start to peak</div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statValue}>{formatSplit(s.eventSplit)}</div>
                <div className={styles.statLabel}>
                  {s.goal ? "Goal" : "Event"} pace {unit}, about {formatDuration(s.eventMinutes * 60)}
                </div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statValue}>{s.slackWeeks}</div>
                <div className={styles.statLabel}>Spare weeks for holding a week</div>
              </div>
            </div>
            {result.flags.length > 0 && (
              <div className={clinicStyles.warningCard} style={{ marginBottom: 0 }}>
                <div className={clinicStyles.warningTitle}>Worth a look</div>
                {result.flags.map((f) => (
                  <div key={f} className={clinicStyles.warningItem}>
                    {f}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={clinicStyles.card}>
            <h2 className={clinicStyles.cardTitle}>Week by week</h2>
            <div className={styles.scroll}>
              <table className={styles.weekTable}>
                <thead>
                  <tr>
                    <th>Week</th>
                    {DAY_NAMES.map((d) => (
                      <th key={d}>{d.slice(0, 3)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: s.totalWeeks }, (_, i) => i + 1).map((w) => (
                    <tr key={w}>
                      <td>
                        <b>{w}</b>
                        <div className={styles.statLabel}>{result.weekLabels[w]}</div>
                      </td>
                      {DAY_NAMES.map((_, di) => {
                        const day = di + 1;
                        const row = result.cards.filter((c) => c.week === w && c.day === day);
                        const str = result.strength.filter((x) => x.week === w && x.day === day);
                        return (
                          <td key={day}>
                            {row.map((c) => (
                              <div key={c.plan.rowing?.key}>{c.plan.title}</div>
                            ))}
                            {str.map((x) => (
                              <div key={x.phase} className={styles.strengthCell}>
                                {strength[x.phase]?.name ?? "Strength"}
                              </div>
                            ))}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {error && <div className={clinicStyles.error}>{error}</div>}

      <div className={styles.buttons}>
        <button type="button" className={clinicStyles.button} disabled={!result.ok || saving} onClick={open}>
          {saving ? "Opening…" : "Open in the programme builder"}
        </button>
      </div>
      <p className={styles.hint} style={{ color: "var(--clinic-on-canvas-muted)" }}>
        Nothing reaches the client until you send it from the programme builder, where every card can still be edited, moved or removed.
      </p>
    </div>
  );
}
