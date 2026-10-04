"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import PatientPicker, { type Patient } from "../PatientPicker";
import AudioRecorder from "../AudioRecorder";
import { scanForPii, type PiiFlag } from "@/lib/piiScan";
import ProgrammeCanvas from "./ProgrammeCanvas";
import WorkoutEditorInline from "./WorkoutEditorInline";
import BuilderShell from "../builder/BuilderShell";
import clinicStyles from "../clinic.module.css";
import { useUnsavedChanges } from "../useUnsavedChanges";
import styles from "./ProgrammeBuilderBar.module.css";
import { planToBuilder, restCode, type PlanCardData } from "@/lib/planToBuilder";
import type { AthenaPlanV1 } from "@/lib/athenaPlan";
import PlanCodeDialog from "./PlanCodeDialog";

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
  /** null or omitted: repeats every week (how every hand-built programme
   * works). A number puts this session in that one week only. */
  week?: number | null;
  /** Set for a card that came from plan code: it belongs to this programme
   * only and carries its own text. */
  plan?: PlanCardData | null;
  /** Plan code said "any" for the day, so the app picked one. Cleared once
   * the card is moved or confirmed. */
  dayNotSet?: boolean;
  order?: number;
  /** Library workouts only: strength-style or cardio, for the colour system. */
  kind?: string;
  /** "Save to library" was tapped on this card. */
  savedToLibrary?: boolean;
};

export type WorkoutOption = { id: string; name: string; high_load?: boolean; kind?: string };

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
  /** ISO date or timestamp the block starts on. Omitted for a new programme, which starts today. */
  initialStartDate?: string;
  /** Days (1 to 7) deliberately marked as rest days. */
  initialRestDays?: number[];
  initialIntro?: string | null;
  initialPlanRules?: { move_on: string; flare: string } | null;
  initialWeekLabels?: Record<number, string> | null;
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
  /** Panels the page owns but that belong in this builder's rails rather
   * than stacked full-width underneath it: cardio goal and save-as-template
   * on the right, the cardio draft in the centre with the rest of the
   * routine. Passed in because they need server-loaded data this client
   * component doesn't have. */
  sidePanels?: ReactNode;
  centrePanels?: ReactNode;
  /** Set only via the voice-brief starting path -- see AutoScaffoldFields. */
  autoScaffold?: AutoScaffoldFields | null;
  /** David's own clinical reasoning on this programme, in his own words --
   * same shape and same purpose as block_notes.notes/workout_notes.notes,
   * persisted, not the transient scaffold "brief" below. */
  initialNotes?: string | null;
  /** Which programme phase the scaffold's hard filter narrows to -- see
   * draftScaffold.ts. Optional: an empty list just means no phase filter
   * is offered here, not a broken feature. */
  phaseTags?: { id: string; name: string }[];
  /** Step 1 of the athena-plan-v1 direction's AI audit -- the "Generate an
   * empty scaffold" card calls draftScaffold.ts, so it's hidden (not
   * removed) whenever clinic_settings.ai_tools_enabled is off. Defaults to
   * false, the same fail-closed default the switch itself starts at. */
  aiToolsEnabled?: boolean;
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
  initialStartDate,
  initialRestDays = [],
  initialIntro = null,
  initialPlanRules = null,
  initialWeekLabels = null,
  initialAudioUrl,
  initialAssignments,
  initialDeliveryMode,
  sourceTemplateId,
  isUnder18Template = false,
  initialParticipantFirstName = null,
  initialParticipantAge = null,
  initialGuardianConfirmedAt = null,
  sidePanels = null,
  centrePanels = null,
  autoScaffold = null,
  initialNotes = null,
  phaseTags = [],
  aiToolsEnabled = false,
}: Props) {
  const [patient, setPatient] = useState<Patient | null>(initialPatient);
  const [title, setTitle] = useState(initialTitle);
  const [blockLengthWeeks, setBlockLengthWeeks] = useState(initialBlockLengthWeeks);
  const [accessWindowWeeks, setAccessWindowWeeks] = useState<number | null>(initialAccessWindowWeeks);
  const [startDate, setStartDate] = useState((initialStartDate ?? new Date().toISOString()).slice(0, 10));
  const [restDays, setRestDays] = useState<number[]>(initialRestDays);
  const [intro, setIntro] = useState(initialIntro ?? "");
  const [planRules, setPlanRules] = useState<{ move_on: string; flare: string } | null>(initialPlanRules);
  const [weekLabels, setWeekLabels] = useState<Record<number, string>>(initialWeekLabels ?? {});
  const [planOpen, setPlanOpen] = useState(false);
  const [clientPrefill, setClientPrefill] = useState<string | undefined>(undefined);
  const [audioUrl, setAudioUrl] = useState<string | null>(initialAudioUrl);
  const [notes, setNotes] = useState(initialNotes ?? "");
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
    startDate,
    restDays,
    intro,
    planRules,
    weekLabels,
    audioUrl,
    assignments,
    deliveryMode,
    guardianConfirmed,
    participantFirstName,
    participantAge,
    notes,
  });

  const [scaffoldOpen, setScaffoldOpen] = useState(false);
  const [focus, setFocus] = useState("");
  const [scaffoldWeeks, setScaffoldWeeks] = useState(initialBlockLengthWeeks);
  const [sessionsPerWeek, setSessionsPerWeek] = useState(3);
  const [equipment, setEquipment] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("intermediate");
  const [brief, setBrief] = useState("");
  const [scaffoldPhaseId, setScaffoldPhaseId] = useState<string>("");
  const [piiFlags, setPiiFlags] = useState<PiiFlag[]>([]);
  const [piiReviewing, setPiiReviewing] = useState(false);
  const [piiAcknowledged, setPiiAcknowledged] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [scaffoldNotices, setScaffoldNotices] = useState<string[] | null>(null);
  const [scaffoldPicksDetail, setScaffoldPicksDetail] = useState<
    { slot: string; block_id: string | null; reason: string | null; matched_tags: string[] }[]
  >([]);

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
  function assignWorkoutToDay(workout: WorkoutOption, day: number, week: number | null, replaceKey: string | null) {
    if (week != null) {
      // Once a programme has sessions tied to particular weeks, every cell is
      // its own place and can hold more than one session.
      setAssignments((prev) => {
        const replaced = replaceKey ? prev.find((r) => r.key === replaceKey) : undefined;
        const base = replaceKey ? prev.filter((r) => r.key !== replaceKey) : prev;
        const order =
          replaced?.order ?? base.filter((r) => r.days.includes(day) && (r.week == null || r.week === week)).length;
        return [
          ...base,
          {
            key: newKey(),
            workout_id: workout.id,
            workout_name: workout.name,
            high_load: workout.high_load,
            kind: workout.kind,
            days: [day],
            week,
            order,
          },
        ];
      });
      setRestDays((prev) => prev.filter((c) => c !== restCode(week, day)));
      return;
    }
    setRestDays((prev) => prev.filter((d) => d !== day));
    setAssignments((prev) => {
      const released = prev.map((row) => ({ ...row, days: row.days.filter((d) => d !== day) }));
      const existingIndex = released.findIndex((row) => row.workout_id === workout.id);
      if (existingIndex >= 0) {
        return released.map((row, i) => (i === existingIndex ? { ...row, days: [...row.days, day] } : row));
      }
      return [
        ...released,
        { key: newKey(), workout_id: workout.id, workout_name: workout.name, high_load: workout.high_load, kind: workout.kind, days: [day] },
      ];
    });
  }

  function toggleRest(day: number, week: number | null) {
    const code = week == null ? day : restCode(week, day);
    setRestDays((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code].sort((a, b) => a - b)));
  }

  // Moves one session to a cell. Always becomes a "this week only" session.
  function moveSession(key: string, week: number, day: number) {
    setAssignments((prev) => {
      const order = prev.filter((r) => r.key !== key && r.days.includes(day) && (r.week == null || r.week === week)).length;
      return prev.map((r) => (r.key === key ? { ...r, week, days: [day], dayNotSet: false, order } : r));
    });
    setRestDays((prev) => prev.filter((c) => c !== restCode(week, day)));
  }

  function updateCard(key: string, patch: Partial<PlanCardData>) {
    setAssignments((prev) =>
      prev.map((r) =>
        r.key === key && r.plan
          ? { ...r, plan: { ...r.plan, ...patch }, workout_name: patch.title !== undefined ? patch.title : r.workout_name }
          : r
      )
    );
  }

  function duplicateCard(key: string) {
    setAssignments((prev) => {
      const src = prev.find((r) => r.key === key);
      if (!src || !src.plan) return prev;
      const order = prev.filter((r) => r.days.some((d) => src.days.includes(d)) && (r.week == null || r.week === src.week)).length;
      return [
        ...prev,
        {
          ...src,
          key: newKey(),
          workout_id: crypto.randomUUID(),
          plan: { ...src.plan, steps: src.plan.steps.map((s) => ({ ...s })) },
          dayNotSet: false,
          savedToLibrary: false,
          order,
        },
      ];
    });
  }

  function saveCardToLibrary(key: string) {
    setAssignments((prev) => prev.map((r) => (r.key === key ? { ...r, savedToLibrary: true } : r)));
  }

  function confirmDay(key: string) {
    setAssignments((prev) => prev.map((r) => (r.key === key ? { ...r, dayNotSet: false } : r)));
  }

  // Fills the builder from plan code that has already been validated.
  function applyPlan(plan: AthenaPlanV1, how: "replace" | "add") {
    const built = planToBuilder(plan);
    const addTo = how === "add" && deliveryMode === "scheduled";
    if (deliveryMode === "open") setDeliveryMode("scheduled");

    const newRows: WorkoutAssignment[] = built.cards.map((c) => ({
      key: newKey(),
      workout_id: crypto.randomUUID(),
      workout_name: c.plan.title,
      high_load: false,
      days: [c.day],
      week: c.week,
      plan: c.plan,
      dayNotSet: c.dayNotSet,
      order: c.order,
    }));
    setAssignments((prev) => (addTo ? [...prev, ...newRows] : newRows));

    const restCodes = built.restCells.map((r) => restCode(r.week, r.day));
    setRestDays((prev) => (addTo ? Array.from(new Set([...prev, ...restCodes])).sort((a, b) => a - b) : restCodes));

    setTitle(plan.block_title);
    setStartDate(plan.start_date);
    setBlockLengthWeeks(addTo ? Math.max(blockLengthWeeks, built.weeks) : built.weeks);
    setIntro(plan.intro);
    setPlanRules({ move_on: plan.rules.move_on, flare: plan.rules.flare });
    setWeekLabels((prev) => (addTo ? { ...prev, ...built.weekLabels } : built.weekLabels));
    setPlanOpen(false);
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
  // transform -- see the two branches below.
  function switchDeliveryMode(next: "scheduled" | "open") {
    if (next === deliveryMode) return;

    if (next === "open") {
      const distinctWorkouts = new Set(assignments.map((a) => a.workout_id));
      if (distinctWorkouts.size > 1) {
        setSwitchModeError(
          `This programme has ${distinctWorkouts.size} different sessions scheduled across the week. Open routines are a single list, so remove down to one session first.`
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
    setScaffoldPicksDetail([]);
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
          phase_id: scaffoldPhaseId || null,
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
      setScaffoldPicksDetail(data.picks_detail ?? []);
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
        start_date: startDate,
        rest_days: deliveryMode === "scheduled" ? restDays : [],
        intro,
        plan_rules: planRules,
        week_labels: weekLabels,
        plan_cards: assignments
          .filter((row) => row.plan)
          .map((row) => ({
            workout_id: row.workout_id,
            name: row.workout_name,
            plan_session: row.plan,
            save_to_library: Boolean(row.savedToLibrary),
          })),
        audio_url: audioUrl,
        delivery_mode: deliveryMode,
        notes: notes.trim() || null,
        assignments:
          deliveryMode === "open"
            ? assignments.slice(0, 1).map((row) => ({ workout_id: row.workout_id, day_of_week: null }))
            : assignments.flatMap((row) =>
                row.days
                  .filter((day): day is number => day != null)
                  .map((day) => ({
                    workout_id: row.workout_id,
                    day_of_week: day,
                    week_number: row.week ?? null,
                    sort_order: row.order ?? 0,
                  }))
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
        startDate,
        restDays,
        intro,
        planRules,
        weekLabels,
        audioUrl,
        assignments,
        deliveryMode,
        guardianConfirmed,
        participantFirstName,
        participantAge,
        notes,
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

  // The manual scaffold-generation card -- kept out of the Open (single
  // workout) layout entirely per the block-builder space pass, but still
  // shown for Scheduled programmes, where "spread across N days" is what
  // it actually generates. Voice-brief auto-generation (see the two
  // effects above) calls runGenerate() directly and doesn't depend on this
  // card being on screen either way.
  const scaffoldCard = (
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

            {phaseTags.length > 0 && (
              <div className={clinicStyles.field}>
                <label className={clinicStyles.label}>Programme phase (optional)</label>
                <select
                  className={clinicStyles.input}
                  value={scaffoldPhaseId}
                  onChange={(e) => setScaffoldPhaseId(e.target.value)}
                >
                  <option value="">Not specified, no phase filter</option>
                  {phaseTags.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <p className={clinicStyles.notice} style={{ marginTop: 4, marginBottom: 0 }}>
                  Narrows the warm-up/activation/cool-down/injury-prevention pool to blocks tagged for this
                  phase, or not yet classified. Blocks tagged for a different phase are excluded before any
                  reasoning happens.
                </p>
              </div>
            )}

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
                placeholder="Paste a brief if you have one. It is checked for identifying details before it's sent."
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
                    I&apos;ve reviewed the above. It&apos;s clinical content only, not an identifier, so send
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

                {scaffoldPicksDetail.length > 0 && (
                  <ul className={clinicStyles.list} style={{ marginBottom: 12 }}>
                    {scaffoldPicksDetail.map((p, i) => (
                      <li key={i}>
                        <b>{p.slot}</b>
                        {p.matched_tags.length > 0 && (
                          <span style={{ color: "var(--muted)" }}>, matched {p.matched_tags.join(", ")}</span>
                        )}
                        {p.reason && <div style={{ fontSize: 13, marginTop: 2 }}>{p.reason}</div>}
                      </li>
                    ))}
                  </ul>
                )}

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
  );

  // Everything else that configures the programme -- the settings that,
  // for the Open (single workout) layout, now sit in a section below the
  // block/exercise builder rather than a persistent right rail.
  const guardianBlocks = (
    <>
      {mode === "create" && isUnder18Template && (
        <div className={clinicStyles.warningCard} style={{ marginBottom: 20 }}>
          <div className={clinicStyles.warningTitle}>Under-18 programme</div>
          <p style={{ fontSize: 13.5, color: "var(--stone)", marginBottom: 12 }}>
            The account below must belong to the participant&apos;s parent or guardian. The young athlete
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

    </>
  );

  const daysCard = (
      <div className={styles.drawerSection}>
          <div className={styles.drawerLabel}>Days</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              className={deliveryMode === "scheduled" ? styles.btnPrimary : styles.btnSecondary}
              style={{ width: "auto", padding: "0 20px" }}
              onClick={() => switchDeliveryMode("scheduled")}
            >
              Fixed
            </button>
            <button
              type="button"
              className={deliveryMode === "open" ? styles.btnPrimary : styles.btnSecondary}
              style={{ width: "auto", padding: "0 20px" }}
              onClick={() => switchDeliveryMode("open")}
            >
              Client chooses
            </button>
          </div>
          <p style={{ fontSize: 13.5, color: "var(--stone)", marginTop: 10, marginBottom: 0 }}>
            {deliveryMode === "scheduled"
              ? "Fixed: a set number of weeks, with sessions assigned to days and week-by-week progression."
              : "Client chooses: a flat list of exercises with prescriptions set once, with no weeks or days, done whenever."}
          </p>
          {switchModeError && (
            <div className={clinicStyles.error} style={{ marginTop: 10 }}>
              {switchModeError}
            </div>
          )}
        </div>

  );

  const perWeek = assignments.some((a) => a.week != null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [accessInfoOpen, setAccessInfoOpen] = useState(false);

  // Everything that used to sit in the right-hand panel, tucked behind one
  // button. A drawer rather than a permanent column, so the page is just the
  // top bar, the grid and the library.
  const moreDrawer = moreOpen && (
    <div className={styles.drawerOverlay} onClick={() => setMoreOpen(false)}>
      <aside className={styles.drawer} onClick={(e) => e.stopPropagation()} aria-label="More options">
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>More options</span>
          <button type="button" className={styles.drawerClose} onClick={() => setMoreOpen(false)} aria-label="Close">
            &times;
          </button>
        </div>

        <div className={styles.drawerSection}>
          <div className={styles.drawerLabel}>
            Access window (weeks)
            <button
              type="button"
              className={styles.infoButton}
              aria-label="More about the access window"
              onClick={() => setAccessInfoOpen((v) => !v)}
            >
              i
            </button>
          </div>
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
          <p className={styles.drawerNote}>
            {accessWindowWeeks == null
              ? "No window set, so this programme never locks behind membership on its own."
              : `Locks behind a membership choice ${accessWindowWeeks} week${accessWindowWeeks === 1 ? "" : "s"} after the start date.`}
          </p>
          {accessInfoOpen && (
            <p className={styles.drawerNote}>
              When the window ends, the client is asked to choose a membership, unless they already have an active
              plan by then. Clear the field for no window.
            </p>
          )}
        </div>

        {daysCard}

        <div className={styles.drawerSection}>
          <div className={styles.drawerLabel}>Intro line</div>
          <input className={clinicStyles.input} value={intro} onChange={(e) => setIntro(e.target.value)} />
        </div>

        <div className={styles.drawerSection}>
          <div className={styles.drawerLabel}>Programme notes (private)</div>
          <textarea
            className={clinicStyles.textarea}
            style={{ minHeight: 90 }}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Your own reasoning on this programme, for your own record."
          />
        </div>

        <div className={styles.drawerSection}>
          <div className={styles.drawerLabel}>Programme message</div>
          <AudioRecorder existingUrl={audioUrl} onUpload={uploadAudio} />
        </div>

        {aiToolsEnabled && deliveryMode === "scheduled" && scaffoldCard}
        {sidePanels}
      </aside>
    </div>
  );

  const submitDisabled =
    saving ||
    !patient ||
    (mode === "create" && sent) ||
    guardianStepIncomplete ||
    (deliveryMode === "open" && assignments.length === 0);

  const submitDisabledReason = !submitDisabled
    ? undefined
    : saving
      ? "Saving"
      : !patient
        ? "Choose a client first"
        : mode === "create" && sent
          ? "Already sent"
          : guardianStepIncomplete
            ? "Fill in the under-18 details first"
            : "Add a session first";

  // The one row across the top: name, client, start date, weeks, Save.
  const builderBar = (
    <>
      <div className={styles.bar}>
        <input
          className={styles.nameInput}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Programme name"
          aria-label="Programme name"
        />
        <div className={styles.barClient}>
          <PatientPicker
            key={clientPrefill ?? "client"}
            selected={patient}
            onSelect={setPatient}
            readOnly={mode === "edit"}
            prefillQuery={clientPrefill}
          />
        </div>
        {deliveryMode === "scheduled" && (
          <>
            <div className={clinicStyles.field} style={{ marginBottom: 0 }}>
              <label className={clinicStyles.label}>Start date</label>
              <input type="date" className={clinicStyles.input} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className={clinicStyles.field} style={{ marginBottom: 0, width: 90 }}>
              <label className={clinicStyles.label}>Weeks</label>
              <input
                type="number"
                min={1}
                max={52}
                className={clinicStyles.input}
                value={blockLengthWeeks}
                onChange={(e) => setBlockLengthWeeks(Math.max(1, Math.min(52, Number(e.target.value) || 1)))}
              />
            </div>
          </>
        )}
        <div className={styles.barActions}>
          <button type="button" className={styles.btnSecondary} style={{ width: "auto", padding: "0 16px" }} onClick={() => setPlanOpen(true)}>
            Paste plan code
          </button>
          <button type="button" className={styles.btnSecondary} style={{ width: "auto", padding: "0 16px" }} onClick={() => setMoreOpen(true)}>
            More options
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            style={{ width: "auto", padding: "0 22px" }}
            disabled={submitDisabled}
            title={submitDisabledReason}
            onClick={handleSubmit}
          >
            {saving ? "Saving…" : mode === "edit" ? "Save" : sent ? "Sent" : "Save and send"}
          </button>
        </div>
      </div>

      {guardianBlocks}

      {error && <div className={clinicStyles.error} style={{ marginBottom: 12 }}>{error}</div>}
      {deliveryMode === "open" && assignments.length === 0 && (
        <p style={{ fontSize: 13.5, color: "var(--clinic-on-canvas-muted)", margin: "0 0 12px" }}>Save the routine before sending.</p>
      )}
      {mode === "create" && sent && (
        <div className={clinicStyles.shareLinkCard} style={{ marginBottom: 12 }}>
          <div className={clinicStyles.smallLabel}>Sent</div>
          <div className={clinicStyles.shareLinkText}>
            It&apos;s in {patient?.first_name}&apos;s account now, with no link to send.
          </div>
        </div>
      )}
      {mode === "create" && sent && emailWarning && (
        <div className={clinicStyles.warningCard} style={{ marginBottom: 12 }}>
          <div className={clinicStyles.warningTitle}>Heads up</div>
          <div className={clinicStyles.warningItem}>
            The welcome email didn&apos;t send ({emailWarning}). {patient?.first_name} will still see it
            in the app next time they open it.
          </div>
        </div>
      )}
      {moreDrawer}
      {planOpen && (
        <PlanCodeDialog
          client={patient}
          hasSessions={assignments.length > 0}
          onBuild={applyPlan}
          onPrefillClient={(name) => setClientPrefill(name)}
          onClose={() => setPlanOpen(false)}
        />
      )}
    </>
  );

  // Open programmes are a single workout, so the workout builder owns the
  // library and the preview; it hands them back here (renderSlots) to sit
  // in this page's own layout rather than building a second shell inside
  // the page. Its programme-level controls are hidden -- this page already
  // owns the access window, message, notes and intro line. No persistent
  // right rail here: the name/format fields sit in a top bar above the
  // block builder, and everything else (this page's own settings sandwiched
  // between the workout builder's high-load flag and its Save button, same
  // relative order as the standalone Workout builder page) sits in a
  // section below it -- see the layout brief this pass implements. The
  // scaffold card is deliberately left out (see scaffoldCard's comment).
  if (deliveryMode === "open") {
    return (
      <WorkoutEditorInline
        workoutId={openWorkoutId}
        mode={assignments.length > 0 ? "edit" : "create"}
        defaultBlockLengthWeeks={1}
        hideProgrammeControls
        singleWeek
        aiToolsEnabled={aiToolsEnabled}
        onSaved={(newName, highLoad) =>
          setAssignments([
            { key: openWorkoutId, workout_id: openWorkoutId, workout_name: newName, high_load: highLoad, days: [null] },
          ])
        }
        renderSlots={({ library, centre, topBar, bottomLead, bottomTail }) => (
          <>
            {builderBar}
            {topBar}
            <BuilderShell
              library={library}
              libraryTitle="Content library"
              centre={
                <>
                  {centre}
                  {centrePanels}
                </>
              }
              controls={null}
            />
            <div className={clinicStyles.bottomSection}>
              {bottomLead}
              {bottomTail}
            </div>
          </>
        )}
      />
    );
  }

  // Scheduled programmes build from the weekly calendar, which has no
  // library of its own to pin -- content is picked inside each day's
  // workout -- so that rail is left out rather than shown empty.
  // The calendar hands back its own two halves: the week grid for the
  // centre, and whatever can be added right now for the library rail --
  // workouts while the grid is showing, that workout's own blocks and
  // exercises once a day is opened.
  return (
    <>
    {builderBar}
    <ProgrammeCanvas
      blockLengthWeeks={blockLengthWeeks}
      assignments={assignments}
      perWeek={perWeek}
      weekLabels={weekLabels}
      restDays={restDays}
      onAssignToDay={assignWorkoutToDay}
      onToggleDay={toggleDay}
      onRemove={removeAssignment}
      onToggleRest={toggleRest}
      onMoveSession={moveSession}
      onUpdateCard={updateCard}
      onDuplicateCard={duplicateCard}
      onSaveCardToLibrary={saveCardToLibrary}
      onConfirmDay={confirmDay}
      onWorkoutRenamed={updateWorkoutMeta}
      renderSlots={({ canvas, library }) => (
        <BuilderShell
          library={library}
          libraryTitle="Content library"
          centreFirst
          centre={
            <>
              {canvas}
              {centrePanels}
            </>
          }
          controls={null}
        />
      )}
    />
    </>
  );
}
