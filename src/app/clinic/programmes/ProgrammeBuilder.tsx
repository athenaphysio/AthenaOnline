"use client";

import { useEffect, useRef, useState } from "react";
import PatientPicker, { type Patient } from "../PatientPicker";
import AudioRecorder from "../AudioRecorder";
import { scanForPii, type PiiFlag } from "@/lib/piiScan";
import ProgrammeCanvas from "./ProgrammeCanvas";
import WorkoutEditorInline from "./WorkoutEditorInline";
import clinicStyles from "../clinic.module.css";
import { useUnsavedChanges } from "../useUnsavedChanges";

const FLAG_LABELS: Record<PiiFlag["type"], string> = {
  name: "Possible name",
  date_of_birth: "Possible date",
  phone: "Possible phone number",
  email: "Possible email address",
  address: "Possible address",
  nhs_number: "Possible NHS number",
};

export type WorkoutAssignment = {
  key: string;
  workout_id: string;
  workout_name: string;
  // A manual, clinician-set flag on the workout itself -- see
  // WorkoutBuilder.tsx. Carried here so the weekly calendar can detect two
  // high-load days scheduled back to back without an extra fetch. Optional
  // (rather than defaulted false) since the Programme Template builder and
  // Coach template pages construct this same shared type without it -- the
  // back-to-back prompt is scoped to the patient-programme calendar only.
  high_load?: boolean;
  // null only ever appears for an Open programme's single workout -- "not
  // tied to any day."
  days: (number | null)[];
};

export type WorkoutOption = { id: string; name: string; high_load?: boolean };

// Confirmed fields from the voice-brief flow (NewProgrammeChoice.tsx /
// VoiceBriefFlow.tsx) -- pre-fills the scaffold panel below and fires its
// existing generate flow once, exactly as if these had been typed in by
// hand. Never applied more than once per mount.
export type AutoScaffoldFields = {
  focus: string;
  weeks: number;
  sessionsPerWeek: number;
  equipment: string;
  experienceLevel: string;
  brief: string;
};

type Props = {
  mode: "create" | "edit";
  programmeId: string;
  initialPatient: Patient | null;
  initialTitle: string;
  initialBlockLengthWeeks: number;
  /** null means no access window -- the programme never auto-closes.
   * Every existing programme starts out this way; only new assignments
   * default to 6 (see instantiateProgramme.ts). Separate from block
   * length on purpose -- see the Phase 1/2 access-window brief. */
  initialAccessWindowWeeks: number | null;
  initialAudioUrl: string | null;
  initialAssignments: WorkoutAssignment[];
  /** Scheduled: today's week/day calendar (unchanged). Open: a flat,
   * unscheduled exercise list -- no weeks, no days, prescriptions set once.
   * Fixed for the life of a create session (decided before the builder
   * opens); switchable here in edit mode. */
  initialDeliveryMode: "scheduled" | "open";
  /** Set when this programme is being instantiated from a Programme
   * Template ("Use this template") -- persisted on save so a Coach later
   * assigned to that template can see the resulting patient. */
  sourceTemplateId?: string | null;
  /** True when the source template is flagged under-18 -- the account
   * holder must be the participant's parent/guardian, never the young
   * athlete themselves. Only meaningful in create mode. */
  isUnder18Template?: boolean;
  /** For edit mode: what was captured at creation, shown read-only --
   * guardian confirmation is a point-in-time record, not something
   * corrected after the fact. */
  initialParticipantFirstName?: string | null;
  initialParticipantAge?: number | null;
  initialGuardianConfirmedAt?: string | null;
  /** Set only via the voice-brief starting path -- see AutoScaffoldFields. */
  autoScaffold?: AutoScaffoldFields | null;
};

let keyCounter = 0;
function newKey(): string {
  keyCounter += 1;
  return `new-${Date.now()}-${keyCounter}`;
}

export default function ProgrammeBuilder({
  mode,
  programmeId,
  initialPatient,
  initialTitle,
  initialBlockLengthWeeks,
  initialAccessWindowWeeks,
  initialAudioUrl,
  initialAssignments,
  initialDeliveryMode,
  sourceTemplateId,
  isUnder18Template = false,
  initialParticipantFirstName = null,
  initialParticipantAge = null,
  initialGuardianConfirmedAt = null,
  autoScaffold = null,
}: Props) {
  const [patient, setPatient] = useState<Patient | null>(initialPatient);
  const [title, setTitle] = useState(initialTitle);
  const [blockLengthWeeks, setBlockLengthWeeks] = useState(initialBlockLengthWeeks);
  const [accessWindowWeeks, setAccessWindowWeeks] = useState<number | null>(initialAccessWindowWeeks);
  const [audioUrl, setAudioUrl] = useState<string | null>(initialAudioUrl);
  const [assignments, setAssignments] = useState<WorkoutAssignment[]>(initialAssignments);
  const [deliveryMode, setDeliveryMode] = useState<"scheduled" | "open">(initialDeliveryMode);
  const [switchModeError, setSwitchModeError] = useState<string | null>(null);
  // The Open workout's id is decided once, up front -- either the real id
  // copied in via Quick Build, or a freshly generated one for a blank Open
  // routine (mirrors how programmeId itself is pre-generated). Stable for
  // the component's lifetime regardless of what `assignments` does later.
  const [openWorkoutId] = useState(() => initialAssignments[0]?.workout_id ?? crypto.randomUUID());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [emailWarning, setEmailWarning] = useState<string | null>(null);

  const [guardianConfirmed, setGuardianConfirmed] = useState(false);
  const [participantFirstName, setParticipantFirstName] = useState("");
  const [participantAge, setParticipantAge] = useState("");

  const { markSaved } = useUnsavedChanges({
    patient,
    title,
    blockLengthWeeks,
    accessWindowWeeks,
    audioUrl,
    assignments,
    deliveryMode,
    guardianConfirmed,
    participantFirstName,
    participantAge,
  });

  const [scaffoldOpen, setScaffoldOpen] = useState(false);
  const [focus, setFocus] = useState("");
  const [scaffoldWeeks, setScaffoldWeeks] = useState(initialBlockLengthWeeks);
  const [sessionsPerWeek, setSessionsPerWeek] = useState(3);
  const [equipment, setEquipment] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("intermediate");
  const [brief, setBrief] = useState("");
  const [piiFlags, setPiiFlags] = useState<PiiFlag[]>([]);
  const [piiReviewing, setPiiReviewing] = useState(false);
  const [piiAcknowledged, setPiiAcknowledged] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [scaffoldNotices, setScaffoldNotices] = useState<string[] | null>(null);

  // Pre-fills the scaffold panel from a confirmed voice brief, then fires
  // its existing generate flow (PII scan + /api/clinic/scaffold) exactly as
  // if these had been typed by hand -- nothing about scaffold generation is
  // duplicated here. Two effects because state setters don't take effect
  // until the next render: the first sets the fields, the second waits
  // until `focus`/`brief` actually reflect them (proof the whole batch has
  // committed, since React applies state updates from one effect together)
  // before calling the unmodified click handler. Runs once per mount.
  const autoScaffoldTriggeredRef = useRef(false);

  useEffect(() => {
    if (!autoScaffold || autoScaffoldTriggeredRef.current) return;
    setScaffoldOpen(true);
    setFocus(autoScaffold.focus);
    setScaffoldWeeks(autoScaffold.weeks);
    setSessionsPerWeek(autoScaffold.sessionsPerWeek);
    setEquipment(autoScaffold.equipment);
    setExperienceLevel(autoScaffold.experienceLevel);
    setBrief(autoScaffold.brief);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoScaffold]);

  useEffect(() => {
    if (!autoScaffold || autoScaffoldTriggeredRef.current) return;
    if (focus !== autoScaffold.focus || brief !== autoScaffold.brief) return;
    autoScaffoldTriggeredRef.current = true;
    handleScaffoldClick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoScaffold, focus, brief]);

  // Assigns a workout to a specific day, placing it immediately -- no
  // separate "add unplaced, then toggle a day" step. Releases that day from
  // whichever row currently holds it (day exclusivity, same rule as
  // toggleDay below), then either extends that workout's existing row or
  // creates a fresh one scoped to just this day.
  function assignWorkoutToDay(workout: WorkoutOption, day: number) {
    setAssignments((prev) => {
      const released = prev.map((row) => ({ ...row, days: row.days.filter((d) => d !== day) }));
      const existingIndex = released.findIndex((row) => row.workout_id === workout.id);
      if (existingIndex >= 0) {
        return released.map((row, i) => (i === existingIndex ? { ...row, days: [...row.days, day] } : row));
      }
      return [
        ...released,
        { key: newKey(), workout_id: workout.id, workout_name: workout.name, high_load: workout.high_load, days: [day] },
      ];
    });
  }

  function removeAssignment(key: string) {
    setAssignments((prev) => prev.filter((a) => a.key !== key));
  }

  // Fired by the inline workout editor after a successful save, so a rename
  // or a high-load flag change shows up on the calendar cell immediately --
  // no reload needed.
  function updateWorkoutMeta(workoutId: string, newName: string, highLoad: boolean) {
    setAssignments((prev) =>
      prev.map((row) =>
        row.workout_id === workoutId ? { ...row, workout_name: newName, high_load: highLoad } : row
      )
    );
  }

  function toggleDay(rowKey: string, day: number) {
    setAssignments((prev) =>
      prev.map((row) => {
        if (row.key === rowKey) {
          const has = row.days.includes(day);
          return { ...row, days: has ? row.days.filter((d) => d !== day) : [...row.days, day] };
        }
        // A day can only belong to one workout at a time -- claiming it
        // here releases it from whichever other row had it.
        return { ...row, days: row.days.filter((d) => d !== day) };
      })
    );
  }

  // Switching delivery mode is a structural change, not a content-preserving
  // transform -- see the two branches below. Only offered in edit mode
  // (create sessions decide this once, before the builder opens).
  function switchDeliveryMode(next: "scheduled" | "open") {
    if (next === deliveryMode) return;

    if (next === "open") {
      const distinctWorkouts = new Set(assignments.map((a) => a.workout_id));
      if (distinctWorkouts.size > 1) {
        setSwitchModeError(
          `This programme has ${distinctWorkouts.size} different sessions scheduled across the week. Open routines are a single list — remove down to one session first.`
        );
        return;
      }
      setSwitchModeError(null);
      setAssignments((prev) => prev.map((row) => ({ ...row, days: [null] })));
      setDeliveryMode("open");
    } else {
      setSwitchModeError(null);
      // The one Open workout becomes an ordinary unplaced library workout --
      // David assigns it to day(s) via the calendar like any other.
      setAssignments((prev) => prev.map((row) => ({ ...row, days: [] })));
      setBlockLengthWeeks(4);
      setDeliveryMode("scheduled");
    }
  }

  function handleScaffoldClick() {
    if (brief.trim()) {
      const flags = scanForPii(brief);
      if (flags.length > 0) {
        setPiiFlags(flags);
        setPiiReviewing(true);
        setPiiAcknowledged(false);
        return;
      }
    }
    runGenerate();
  }

  async function runGenerate() {
    setGenerating(true);
    setGenerateError(null);
    setScaffoldNotices(null);
    try {
      const res = await fetch("/api/clinic/scaffold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          focus,
          sessions_per_week: sessionsPerWeek,
          equipment,
          experience_level: experienceLevel,
          brief,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");

      const newWorkouts = data.workouts as { id: string; name: string; day_of_week: number }[];
      const newDays = new Set(newWorkouts.map((w) => w.day_of_week));
      const contextTags = (data.context_tags ?? []) as string[];

      for (const w of newWorkouts) {
        try {
          localStorage.setItem(
            `athena_workout_context:${w.id}`,
            JSON.stringify({ focus, equipment, experienceLevel, tags: contextTags })
          );
        } catch {
          // Best-effort only -- ranking suggestions simply won't appear if this fails.
        }
      }

      setBlockLengthWeeks(scaffoldWeeks);
      setAssignments((prev) => [
        // A day can only belong to one workout -- the freshly generated
        // schedule wins over anything that previously claimed the same day.
        ...prev.map((row) => ({ ...row, days: row.days.filter((d) => d == null || !newDays.has(d)) })),
        ...newWorkouts.map((w) => ({
          key: newKey(),
          workout_id: w.id,
          workout_name: w.name,
          high_load: false,
          days: [w.day_of_week],
        })),
      ]);
      setScaffoldNotices(data.notices ?? []);
      setPiiReviewing(false);
      setFocus("");
      setBrief("");
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setGenerating(false);
    }
  }

  async function uploadAudio(blob: Blob): Promise<string> {
    const formData = new FormData();
    formData.append("programme_id", programmeId);
    formData.append("audio", blob, "recording.webm");
    const res = await fetch("/api/clinic/audio/programme", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed.");
    setAudioUrl(data.url);
    return data.url;
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        id: programmeId,
        patient_id: patient?.id,
        title,
        block_length_weeks: blockLengthWeeks,
        access_window_weeks: accessWindowWeeks,
        audio_url: audioUrl,
        delivery_mode: deliveryMode,
        assignments:
          deliveryMode === "open"
            ? assignments.slice(0, 1).map((row) => ({ workout_id: row.workout_id, day_of_week: null }))
            : assignments.flatMap((row) =>
                row.days
                  .filter((day): day is number => day != null)
                  .map((day) => ({ workout_id: row.workout_id, day_of_week: day }))
              ),
        // Covers both a from-scratch Bespoke Build and a Quick Build copy --
        // either way the server checks the patient's live membership status
        // at this moment to decide subscription-gated vs clinician-assigned.
        ...(mode === "create" ? { origin: "builder" } : {}),
        ...(mode === "create" && sourceTemplateId ? { source_template_id: sourceTemplateId } : {}),
        ...(mode === "create" && isUnder18Template
          ? {
              guardian_confirmed: guardianConfirmed,
              participant_first_name: participantFirstName.trim(),
              participant_age: Number(participantAge),
            }
          : {}),
      };

      const res = await fetch(
        mode === "create" ? "/api/clinic/programmes" : `/api/clinic/programmes/${programmeId}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed.");
      setSent(true);
      setEmailWarning(mode === "create" && data.email_sent === false ? data.email_error ?? "Unknown error." : null);
      markSaved({
        patient,
        title,
        blockLengthWeeks,
        accessWindowWeeks,
        audioUrl,
        assignments,
        deliveryMode,
        guardianConfirmed,
        participantFirstName,
        participantAge,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const guardianStepIncomplete =
    mode === "create" &&
    isUnder18Template &&
    (!guardianConfirmed || !participantFirstName.trim() || !participantAge || Number(participantAge) <= 0);

  return (
    <div>
      <div className={clinicStyles.card}>
        <div className={clinicStyles.cardTitle}>Generate an empty scaffold</div>
        {!scaffoldOpen ? (
          <button type="button" className={clinicStyles.buttonSecondary} onClick={() => setScaffoldOpen(true)}>
            Set up a new programme frame
          </button>
        ) : (
          <>
            <p style={{ fontSize: 13.5, color: "var(--stone)", marginBottom: 14 }}>
              Builds the right number of sessions on sensible default days, each pre-structured warm-up /
              activation / main body / injury prevention / cool-down. Warm-up, activation and cool-down get
              a sensible pick from your own library; main body is left empty for you to fill.
            </p>

            <div className={clinicStyles.row2}>
              <div className={clinicStyles.field}>
                <label className={clinicStyles.label}>Focus</label>
                <input
                  className={clinicStyles.input}
                  placeholder="e.g. shoulder"
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                />
              </div>
              <div className={clinicStyles.field}>
                <label className={clinicStyles.label}>Experience level</label>
                <select
                  className={clinicStyles.input}
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value)}
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
            </div>

            <div className={clinicStyles.row2}>
              <div className={clinicStyles.field}>
                <label className={clinicStyles.label}>Weeks</label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  className={clinicStyles.input}
                  value={scaffoldWeeks}
                  onChange={(e) => setScaffoldWeeks(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
                />
              </div>
              <div className={clinicStyles.field}>
                <label className={clinicStyles.label}>Sessions per week</label>
                <input
                  type="number"
                  min={1}
                  max={7}
                  className={clinicStyles.input}
                  value={sessionsPerWeek}
                  onChange={(e) => setSessionsPerWeek(Math.max(1, Math.min(7, Number(e.target.value) || 1)))}
                />
              </div>
            </div>

            <div className={clinicStyles.field}>
              <label className={clinicStyles.label}>Equipment available</label>
              <input
                className={clinicStyles.input}
                placeholder="e.g. dumbbells and bands, no barbell"
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
              />
            </div>

            <div className={clinicStyles.field}>
              <label className={clinicStyles.label}>Clinical brief (optional)</label>
              <textarea
                className={clinicStyles.textarea}
                style={{ minHeight: 100 }}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="Paste a brief if you have one — checked for identifying details before it's sent."
              />
            </div>

            {piiReviewing && (
              <div className={clinicStyles.warningCard}>
                <div className={clinicStyles.warningTitle}>
                  {piiFlags.length} possible identifier{piiFlags.length === 1 ? "" : "s"} found in the brief
                </div>
                {piiFlags.map((flag, i) => (
                  <div key={i} className={clinicStyles.warningItem}>
                    <b>{FLAG_LABELS[flag.type]}:</b> &ldquo;{flag.match}&rdquo;
                    <br />
                    <span style={{ color: "var(--muted)" }}>…{flag.context}…</span>
                  </div>
                ))}
                <label
                  style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 12, fontSize: 13.5 }}
                >
                  <input
                    type="checkbox"
                    checked={piiAcknowledged}
                    onChange={(e) => setPiiAcknowledged(e.target.checked)}
                    style={{ marginTop: 3 }}
                  />
                  <span>
                    I&apos;ve reviewed the above. It&apos;s clinical content only, not an identifier — send
                    anyway.
                  </span>
                </label>
              </div>
            )}

            {generateError && <div className={clinicStyles.error}>{generateError}</div>}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                className={clinicStyles.button}
                style={{ width: "auto", padding: "0 20px" }}
                disabled={generating || !focus.trim() || (piiReviewing && !piiAcknowledged)}
                onClick={piiReviewing ? runGenerate : handleScaffoldClick}
              >
                {generating ? "Generating…" : piiReviewing ? "Confirm & generate" : "Generate scaffold"}
              </button>
              <button
                type="button"
                className={clinicStyles.buttonSecondary}
                style={{ width: "auto", padding: "0 20px" }}
                onClick={() => {
                  setScaffoldOpen(false);
                  setPiiReviewing(false);
                }}
              >
                Cancel
              </button>
            </div>

            {scaffoldNotices && (
              <div className={clinicStyles.draftRefCard} style={{ marginTop: 14 }}>
                <div className={clinicStyles.draftRefTitle}>Scaffold generated</div>
                {scaffoldNotices.length === 0 ? (
                  <p style={{ fontSize: 13.5, color: "var(--stone)" }}>
                    Every warm-up / activation / cool-down slot got a sensible pick.
                  </p>
                ) : (
                  <ul className={clinicStyles.list}>
                    {scaffoldNotices.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {mode === "create" && isUnder18Template && (
        <div className={clinicStyles.warningCard} style={{ marginBottom: 20 }}>
          <div className={clinicStyles.warningTitle}>Under-18 programme</div>
          <p style={{ fontSize: 13.5, color: "var(--stone)", marginBottom: 12 }}>
            The account below must belong to the participant&apos;s parent or guardian — the young athlete
            never gets their own login, and no messaging ever goes to them directly.
          </p>
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 14, fontSize: 13.5 }}>
            <input
              type="checkbox"
              checked={guardianConfirmed}
              onChange={(e) => setGuardianConfirmed(e.target.checked)}
              style={{ marginTop: 3 }}
            />
            <span>The buyer has confirmed they are the parent or guardian of the participant.</span>
          </label>
          <div className={clinicStyles.row2}>
            <div className={clinicStyles.field}>
              <label className={clinicStyles.label}>Participant&apos;s first name</label>
              <input
                className={clinicStyles.input}
                value={participantFirstName}
                onChange={(e) => setParticipantFirstName(e.target.value)}
              />
            </div>
            <div className={clinicStyles.field}>
              <label className={clinicStyles.label}>Participant&apos;s age</label>
              <input
                type="number"
                min={1}
                max={17}
                className={clinicStyles.input}
                value={participantAge}
                onChange={(e) => setParticipantAge(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {mode === "edit" && initialGuardianConfirmedAt && (
        <div className={clinicStyles.card} style={{ marginBottom: 20 }}>
          <div className={clinicStyles.cardTitle}>Under-18 programme</div>
          <p style={{ fontSize: 13.5, color: "var(--stone)" }}>
            Participant: {initialParticipantFirstName}
            {initialParticipantAge != null ? `, age ${initialParticipantAge}` : ""}. Guardian confirmed{" "}
            {new Date(initialGuardianConfirmedAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
            .
          </p>
        </div>
      )}

      {mode === "edit" && (
        <div className={clinicStyles.card} style={{ marginBottom: 20 }}>
          <div className={clinicStyles.cardTitle}>Delivery</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              className={deliveryMode === "scheduled" ? clinicStyles.button : clinicStyles.buttonSecondary}
              style={{ width: "auto", padding: "0 20px" }}
              onClick={() => switchDeliveryMode("scheduled")}
            >
              Scheduled
            </button>
            <button
              type="button"
              className={deliveryMode === "open" ? clinicStyles.button : clinicStyles.buttonSecondary}
              style={{ width: "auto", padding: "0 20px" }}
              onClick={() => switchDeliveryMode("open")}
            >
              Open
            </button>
          </div>
          <p style={{ fontSize: 13.5, color: "var(--stone)", marginTop: 10, marginBottom: 0 }}>
            {deliveryMode === "scheduled"
              ? "A set number of weeks, sessions assigned to days, with week-by-week progression."
              : "A flat list of exercises with prescriptions set once -- no weeks, no days, done whenever."}
          </p>
          {switchModeError && (
            <div className={clinicStyles.error} style={{ marginTop: 10 }}>
              {switchModeError}
            </div>
          )}
        </div>
      )}

      {/* A light card, not bare fields on the canvas -- these used to sit
          directly on the page background, which only worked while that
          background was pale. */}
      <div className={clinicStyles.card}>
        <div className={deliveryMode === "scheduled" ? clinicStyles.row2 : undefined}>
          <PatientPicker selected={patient} onSelect={setPatient} readOnly={mode === "edit"} />
          {deliveryMode === "scheduled" && (
            <div className={clinicStyles.field}>
              <label className={clinicStyles.label}>Block length (weeks)</label>
              <input
                type="number"
                min={1}
                max={12}
                className={clinicStyles.input}
                value={blockLengthWeeks}
                onChange={(e) => setBlockLengthWeeks(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
              />
            </div>
          )}
        </div>

        <div className={clinicStyles.field}>
          <label className={clinicStyles.label}>Access window (weeks)</label>
          <input
            type="number"
            min={1}
            className={clinicStyles.input}
            value={accessWindowWeeks ?? ""}
            placeholder="No window, never closes"
            onChange={(e) => {
              const raw = e.target.value;
              setAccessWindowWeeks(raw === "" ? null : Math.max(1, Number(raw) || 1));
            }}
          />
          <p className={clinicStyles.notice} style={{ marginTop: 4, marginBottom: 0 }}>
            {accessWindowWeeks == null
              ? "No window set. This programme's content never locks behind membership on its own."
              : `Locks behind a membership choice ${accessWindowWeeks} week${accessWindowWeeks === 1 ? "" : "s"} after the start date, unless the patient already has an active plan by then. Clear the field for no window.`}
          </p>
        </div>

        <div className={clinicStyles.field} style={{ marginBottom: 0 }}>
          <label className={clinicStyles.label}>Intro line</label>
          <input className={clinicStyles.input} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
      </div>

      <div className={clinicStyles.card}>
        <div className={clinicStyles.cardTitle}>Programme message</div>
        <AudioRecorder existingUrl={audioUrl} onUpload={uploadAudio} />
      </div>

      {deliveryMode === "scheduled" ? (
        <ProgrammeCanvas
          title={title}
          patientName={patient?.first_name ?? null}
          blockLengthWeeks={blockLengthWeeks}
          assignments={assignments}
          onAssignToDay={assignWorkoutToDay}
          onToggleDay={toggleDay}
          onRemove={removeAssignment}
          onWorkoutRenamed={updateWorkoutMeta}
        />
      ) : (
        <div className={clinicStyles.card}>
          <div className={clinicStyles.cardTitle}>The routine</div>
          <WorkoutEditorInline
            workoutId={openWorkoutId}
            mode={assignments.length > 0 ? "edit" : "create"}
            defaultBlockLengthWeeks={1}
            onSaved={(newName, highLoad) =>
              setAssignments([
                { key: openWorkoutId, workout_id: openWorkoutId, workout_name: newName, high_load: highLoad, days: [null] },
              ])
            }
          />
        </div>
      )}

      {error && (
        <div className={clinicStyles.error} style={{ marginTop: 16 }}>
          {error}
        </div>
      )}

      {deliveryMode === "open" && assignments.length === 0 && (
        <p style={{ fontSize: 13.5, color: "var(--stone)", marginTop: 16 }}>
          Save the routine above before sending.
        </p>
      )}

      <button
        type="button"
        className={clinicStyles.button}
        style={{ marginTop: 20 }}
        disabled={
          saving ||
          !patient ||
          (mode === "create" && sent) ||
          guardianStepIncomplete ||
          (deliveryMode === "open" && assignments.length === 0)
        }
        onClick={handleSubmit}
      >
        {saving ? "Saving…" : mode === "edit" ? "Save changes" : sent ? "Sent" : "Send"}
      </button>

      {mode === "create" && sent && (
        <div className={clinicStyles.shareLinkCard}>
          <div className={clinicStyles.smallLabel}>Sent</div>
          <div className={clinicStyles.shareLinkText}>
            It&apos;s in {patient?.first_name}&apos;s account now — no link to send.
          </div>
        </div>
      )}

      {mode === "create" && sent && emailWarning && (
        <div className={clinicStyles.warningCard} style={{ marginTop: 12 }}>
          <div className={clinicStyles.warningTitle}>Heads up</div>
          <div className={clinicStyles.warningItem}>
            The welcome email didn&apos;t send ({emailWarning}). {patient?.first_name} will still see it
            in the app next time they open it.
          </div>
        </div>
      )}
    </div>
  );
}
