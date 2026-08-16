"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ProgrammeBuilder, { type WorkoutAssignment, type AutoScaffoldFields } from "../ProgrammeBuilder";
import type { Patient } from "../../PatientPicker";
import clinicStyles from "../../clinic.module.css";
import styles from "./NewProgrammeChoice.module.css";
import VoiceBriefFlow, { type ScaffoldBriefConfirmed } from "./VoiceBriefFlow";

type SourceType = "template" | "programme";
type DeliveryMode = "scheduled" | "open";

type TemplateSource = {
  id: string;
  name: string;
  block_length_weeks: number;
  is_under_18: boolean;
  delivery_mode: DeliveryMode;
  focus_area: string;
};

type ProgrammeSource = {
  id: string;
  title: string;
  block_length_weeks: number;
  patient_first_name: string;
  delivery_mode: DeliveryMode;
  focus_area: string;
};

type PickerRow = {
  sourceType: SourceType;
  id: string;
  label: string;
  focusArea: string;
  blockLengthWeeks: number;
  isUnder18: boolean;
  deliveryMode: DeliveryMode;
  context: string | null;
};

type BuilderState = {
  programmeId: string;
  initialTitle: string;
  initialBlockLengthWeeks: number;
  initialAssignments: WorkoutAssignment[];
  sourceTemplateId: string | null;
  isUnder18Template: boolean;
  deliveryMode: DeliveryMode;
  copyNotice: string | null;
  /** Set only via the voice-brief path -- pre-fills the scaffold panel's own
   * fields and fires its existing generate flow once the builder mounts, so
   * nothing about scaffold generation itself is duplicated here. */
  autoScaffold?: AutoScaffoldFields | null;
};

// "top" -- Quick Assign vs Build a Programme. "start-from" -- the existing
// Quick Build vs Bespoke vs Voice Brief choice, only reached from Build a
// Programme. "delivery" -- Scheduled vs Open, only asked for Bespoke (a
// Quick Build copy always inherits its source's own delivery mode -- there's
// no sane way to turn a week/day calendar into a flat list or back
// automatically; Voice Brief always lands on Scheduled, since sessions per
// week only means something there).
type Step = "top" | "start-from" | "quick-picker" | "delivery" | "voice-brief" | "copying" | "builder";

type Props = {
  programmeId: string;
  autoSource: { type: SourceType; id: string } | null;
  /** Set when arriving via a patient record's "Assign" button -- pre-fills
   * (not locks) the patient in the builder instead of an empty picker. */
  initialPatient: Patient | null;
};

// Both "Quick Build" and "Bespoke Build" land in the exact same
// ProgrammeBuilder -- the only difference is what's already in it when it
// opens. This also doubles as the landing spot for the old "Use this
// template" / "Duplicate & retitle" links (via autoSource), which now run
// through the same real copy instead of their old shallow one.
export default function NewProgrammeChoice({ programmeId, autoSource, initialPatient }: Props) {
  const [step, setStep] = useState<Step>(autoSource ? "copying" : "top");
  const [builder, setBuilder] = useState<BuilderState | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [pickingId, setPickingId] = useState<string | null>(null);

  const [sources, setSources] = useState<{ templates: TemplateSource[]; programmes: ProgrammeSource[] } | null>(
    null
  );
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [focusFilter, setFocusFilter] = useState("");

  useEffect(() => {
    if (autoSource) runQuickBuild(autoSource.type, autoSource.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (step !== "quick-picker" || sources) return;
    setSourcesLoading(true);
    fetch("/api/clinic/programmes/quick-build-sources")
      .then((res) => res.json())
      .then((data) => setSources({ templates: data.templates ?? [], programmes: data.programmes ?? [] }))
      .catch(() => setSources({ templates: [], programmes: [] }))
      .finally(() => setSourcesLoading(false));
  }, [step, sources]);

  const combined: PickerRow[] = useMemo(() => {
    if (!sources) return [];
    return [
      ...sources.templates.map((t) => ({
        sourceType: "template" as const,
        id: t.id,
        label: t.name,
        focusArea: t.focus_area,
        blockLengthWeeks: t.block_length_weeks,
        isUnder18: t.is_under_18,
        deliveryMode: t.delivery_mode,
        context: null,
      })),
      ...sources.programmes.map((p) => ({
        sourceType: "programme" as const,
        id: p.id,
        label: p.title,
        focusArea: p.focus_area,
        blockLengthWeeks: p.block_length_weeks,
        isUnder18: false,
        deliveryMode: p.delivery_mode,
        context: p.patient_first_name,
      })),
    ];
  }, [sources]);

  const focusOptions = useMemo(
    () => Array.from(new Set(combined.map((i) => i.focusArea))).sort((a, b) => a.localeCompare(b)),
    [combined]
  );

  const filtered = combined.filter((item) => {
    if (focusFilter && item.focusArea !== focusFilter) return false;
    const q = query.trim().toLowerCase();
    if (q && !item.label.toLowerCase().includes(q)) return false;
    return true;
  });

  async function runQuickBuild(sourceType: SourceType, sourceId: string) {
    setStep("copying");
    setCopyError(null);
    setPickingId(sourceId);
    try {
      const res = await fetch("/api/clinic/programmes/quick-build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_type: sourceType, source_id: sourceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't copy that.");
      setBuilder({
        programmeId: data.programmeId,
        initialTitle: data.title,
        initialBlockLengthWeeks: data.blockLengthWeeks,
        initialAssignments: data.assignments,
        sourceTemplateId: data.sourceTemplateId,
        isUnder18Template: data.isUnder18Template,
        deliveryMode: data.deliveryMode,
        copyNotice: data.copyNotice,
      });
      setStep("builder");
    } catch (err) {
      setCopyError(err instanceof Error ? err.message : "Couldn't copy that.");
      setStep(autoSource ? "top" : "quick-picker");
    } finally {
      setPickingId(null);
    }
  }

  function startBespoke(deliveryMode: DeliveryMode) {
    setBuilder({
      programmeId,
      initialTitle: "",
      initialBlockLengthWeeks: 4,
      initialAssignments: [],
      sourceTemplateId: null,
      isUnder18Template: false,
      deliveryMode,
      copyNotice: null,
    });
    setStep("builder");
  }

  // Always Scheduled -- "sessions per week" (one of the confirmed fields)
  // has no meaning for an Open routine's single flat list.
  function startFromVoiceBrief(fields: ScaffoldBriefConfirmed) {
    setBuilder({
      programmeId,
      initialTitle: "",
      initialBlockLengthWeeks: fields.weeks,
      initialAssignments: [],
      sourceTemplateId: null,
      isUnder18Template: false,
      deliveryMode: "scheduled",
      copyNotice: null,
      autoScaffold: {
        focus: fields.focus,
        weeks: fields.weeks,
        sessionsPerWeek: fields.sessionsPerWeek,
        equipment: fields.equipment,
        experienceLevel: fields.experienceLevel,
        brief: fields.brief,
      },
    });
    setStep("builder");
  }

  if (step === "builder" && builder) {
    return (
      <div>
        {builder.copyNotice && (
          <div className={clinicStyles.warningCard}>
            <div className={clinicStyles.warningTitle}>Review before sending</div>
            <div className={clinicStyles.warningItem}>{builder.copyNotice}</div>
          </div>
        )}
        <ProgrammeBuilder
          mode="create"
          programmeId={builder.programmeId}
          initialPatient={initialPatient}
          initialTitle={builder.initialTitle}
          initialBlockLengthWeeks={builder.initialBlockLengthWeeks}
          initialAccessWindowWeeks={6}
          initialAudioUrl={null}
          initialAssignments={builder.initialAssignments}
          initialDeliveryMode={builder.deliveryMode}
          sourceTemplateId={builder.sourceTemplateId}
          isUnder18Template={builder.isUnder18Template}
          autoScaffold={builder.autoScaffold ?? null}
        />
      </div>
    );
  }

  if (step === "voice-brief") {
    return <VoiceBriefFlow onConfirm={startFromVoiceBrief} onBack={() => setStep("start-from")} />;
  }

  if (step === "copying") {
    return <div className={styles.loading}>Copying…</div>;
  }

  if (step === "quick-picker") {
    return (
      <div>
        <button type="button" className={styles.backLink} onClick={() => setStep("start-from")}>
          ← Back
        </button>
        <div className={styles.pickerHeader}>
          <input
            className={styles.searchInput}
            placeholder="Search by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className={styles.filterSelect}
            value={focusFilter}
            onChange={(e) => setFocusFilter(e.target.value)}
          >
            <option value="">All focus areas</option>
            {focusOptions.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        {copyError && (
          <div className={clinicStyles.error} style={{ marginBottom: 14 }}>
            {copyError}
          </div>
        )}

        {sourcesLoading && (
          <p className={clinicStyles.notice} style={{ color: "var(--clinic-on-canvas-muted)" }}>
            Loading…
          </p>
        )}
        {!sourcesLoading && filtered.length === 0 && (
          <p className={clinicStyles.notice} style={{ color: "var(--clinic-on-canvas-muted)" }}>
            Nothing matches. Build a template or send a programme first.
          </p>
        )}

        <div className={styles.list}>
          {filtered.map((item) => (
            <div key={`${item.sourceType}-${item.id}`} className={styles.row}>
              <div className={styles.rowMain}>
                <span className={styles.rowLabel}>{item.label}</span>
                <span className={styles.rowTag}>{item.sourceType === "template" ? "Template" : "Past programme"}</span>
                <span className={styles.rowTag}>{item.deliveryMode === "open" ? "Open" : "Scheduled"}</span>
                {item.context && <span className={styles.rowContext}>for {item.context}</span>}
                {item.isUnder18 && <span className={styles.rowTag}>Under-18</span>}
              </div>
              <div className={styles.rowMeta}>
                <span className={styles.rowMetaText}>{item.focusArea}</span>
                <span className={styles.rowMetaText}>{item.blockLengthWeeks}wk</span>
                <button
                  type="button"
                  className={styles.useButton}
                  disabled={pickingId === item.id}
                  onClick={() => runQuickBuild(item.sourceType, item.id)}
                >
                  {pickingId === item.id ? "Copying…" : "Use this"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (step === "delivery") {
    return (
      <div>
        <button type="button" className={styles.backLink} onClick={() => setStep("start-from")}>
          ← Back
        </button>
        <div className={styles.choiceGrid}>
          <button type="button" className={styles.choiceCard} onClick={() => startBespoke("scheduled")}>
            <div className={styles.choiceTitle}>Scheduled</div>
            <p className={styles.choiceDescription}>
              A set number of weeks, sessions assigned to days, with week-by-week progression. The calendar
              builder as it stands.
            </p>
          </button>
          <button type="button" className={styles.choiceCard} onClick={() => startBespoke("open")}>
            <div className={styles.choiceTitle}>Open</div>
            <p className={styles.choiceDescription}>
              A flat list of exercises, optionally grouped into sections, with prescriptions set once. No
              weeks, no days -- done whenever.
            </p>
          </button>
        </div>
      </div>
    );
  }

  if (step === "start-from") {
    return (
      <div>
        <button type="button" className={styles.backLink} onClick={() => setStep("top")}>
          ← Back
        </button>
        {copyError && (
          <div className={clinicStyles.error} style={{ marginBottom: 14 }}>
            {copyError}
          </div>
        )}
        <div className={styles.choiceGrid}>
          <button type="button" className={styles.choiceCard} onClick={() => setStep("quick-picker")}>
            <div className={styles.choiceTitle}>Quick Build</div>
            <p className={styles.choiceDescription}>
              Start from an existing template or a past programme you&apos;ve built for another client.
            </p>
          </button>
          <button type="button" className={styles.choiceCard} onClick={() => setStep("delivery")}>
            <div className={styles.choiceTitle}>Bespoke Build</div>
            <p className={styles.choiceDescription}>Start from scratch, or from an AI scaffold.</p>
          </button>
          <button type="button" className={styles.choiceCard} onClick={() => setStep("voice-brief")}>
            <div className={styles.choiceTitle}>New template from voice brief</div>
            <p className={styles.choiceDescription}>
              Record a short spoken description -- focus, weeks, sessions per week, equipment, experience
              level -- and confirm before it feeds the scaffold generator.
            </p>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.choiceGrid}>
        <Link
          href={initialPatient ? `/clinic/programmes/quick-assign?patient=${initialPatient.id}` : "/clinic/programmes/quick-assign"}
          className={styles.choiceCard}
          style={{ textDecoration: "none", display: "block" }}
        >
          <div className={styles.choiceTitle}>Quick Assign</div>
          <p className={styles.choiceDescription}>
            Hand a client a handful of standalone exercises, right now -- no calendar, no clinical guide to
            write.
          </p>
        </Link>
        <button type="button" className={styles.choiceCard} onClick={() => setStep("start-from")}>
          <div className={styles.choiceTitle}>Build a Programme</div>
          <p className={styles.choiceDescription}>
            The full builder -- start from something existing or from scratch, scheduled or open.
          </p>
        </button>
      </div>
    </div>
  );
}
