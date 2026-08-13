"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clinicStyles from "../clinic.module.css";
import PickerCanvas, { PickerThumb, PickerResultBody } from "../builder/PickerCanvas";
import type { WorkoutAssignment, WorkoutOption } from "../programmes/ProgrammeBuilder";
import WorkoutEditorInline from "../programmes/WorkoutEditorInline";
import ImageUploader from "../ImageUploader";
import { useUnsavedChanges } from "../useUnsavedChanges";
import styles from "./ProgrammeTemplateBuilder.module.css";

const DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
];

type Props = {
  mode: "create" | "edit";
  templateId: string;
  initialName: string;
  initialBlockLengthWeeks: number;
  initialAssignments: WorkoutAssignment[];
  initialPhases?: { name: string; start_week: number; end_week: number }[];
  initialIsUnder18?: boolean;
  /** Scheduled: the weekly schedule below (unchanged). Open: a flat,
   * unscheduled exercise list. Chosen once when a template is created from
   * scratch here; a template copied from a programme just inherits whatever
   * that programme already was. */
  initialDeliveryMode?: "scheduled" | "open";
  /** Paid (default) goes through the shop's Stripe checkout when linked to
   * a listing; Free skips payment entirely and hands the patient the
   * programme straight away. price_gbp only matters when access is paid. */
  initialAccess?: "paid" | "free";
  initialPriceGBP?: number | null;
  /** The photo shown on this programme's shop card and detail page --
   * absent shows a calm "In construction" placeholder there instead of a
   * broken image. */
  initialCoverImageUrl?: string | null;
  /** Lets this same builder be reused from the Coach area, which hits its
   * own RLS-scoped routes instead of the Owner-only /api/clinic/* ones. */
  apiBasePath?: string;
  workoutSearchEndpoint?: string;
  /** The "Edit this workout" link only makes sense where the viewer can
   * actually reach /clinic/workouts -- off for Coach, who can't. */
  showWorkoutEditLink?: boolean;
  /** Whether this programme applies to under-18s is a compliance decision,
   * not a scheduling one -- Coach sees it, but only Owner can change it. */
  canEditUnder18Flag?: boolean;
  /** Pricing is a business decision, same reasoning as canEditUnder18Flag --
   * Coach sees the current setting, only Owner can change it. */
  canEditAccessAndPrice?: boolean;
  /** Off for Coach -- there's no matching /api/coach/.../cover-image route,
   * so the upload control would just 404 there. Content/shop management is
   * an Owner-only surface for now. */
  canEditCoverImage?: boolean;
};

let keyCounter = 0;
function newKey(): string {
  keyCounter += 1;
  return `new-${Date.now()}-${keyCounter}`;
}

type PhaseRow = { key: string; name: string; startWeek: number; endWeek: number };

export default function ProgrammeTemplateBuilder({
  mode,
  templateId,
  initialName,
  initialBlockLengthWeeks,
  initialAssignments,
  initialPhases = [],
  initialIsUnder18 = false,
  initialDeliveryMode = "scheduled",
  initialAccess = "paid",
  initialPriceGBP = null,
  initialCoverImageUrl = null,
  apiBasePath = "/api/clinic/programme-templates",
  workoutSearchEndpoint = "/api/clinic/workouts/search",
  showWorkoutEditLink = true,
  canEditUnder18Flag = true,
  canEditAccessAndPrice = true,
  canEditCoverImage = true,
}: Props) {
  const [name, setName] = useState(initialName);
  const [blockLengthWeeks, setBlockLengthWeeks] = useState(initialBlockLengthWeeks);
  const [isUnder18, setIsUnder18] = useState(initialIsUnder18);
  const [assignments, setAssignments] = useState<WorkoutAssignment[]>(initialAssignments);
  const [phases, setPhases] = useState<PhaseRow[]>(
    initialPhases.map((p) => ({ key: newKey(), name: p.name, startWeek: p.start_week, endWeek: p.end_week }))
  );
  const [deliveryMode, setDeliveryMode] = useState<"scheduled" | "open">(initialDeliveryMode);
  const [access, setAccess] = useState<"paid" | "free">(initialAccess);
  const [priceGBP, setPriceGBP] = useState(initialPriceGBP != null ? String(initialPriceGBP) : "");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(initialCoverImageUrl);
  const [openWorkoutId] = useState(() => initialAssignments[0]?.workout_id ?? crypto.randomUUID());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { markSaved } = useUnsavedChanges({
    name,
    blockLengthWeeks,
    isUnder18,
    assignments,
    phases,
    deliveryMode,
    access,
    priceGBP,
    coverImageUrl,
  });

  function addPhase() {
    const lastEnd = phases.length > 0 ? phases[phases.length - 1].endWeek : 0;
    setPhases((prev) => [
      ...prev,
      { key: newKey(), name: "", startWeek: Math.min(lastEnd + 1, blockLengthWeeks), endWeek: blockLengthWeeks },
    ]);
  }

  function removePhase(key: string) {
    setPhases((prev) => prev.filter((p) => p.key !== key));
  }

  function updatePhase(key: string, patch: Partial<Omit<PhaseRow, "key">>) {
    setPhases((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }

  // Non-blocking -- David notices before saving, but a gap or overlap
  // never stops the save itself.
  const phaseWarning = useMemo(() => {
    if (deliveryMode !== "scheduled" || phases.length === 0) return null;
    const coverage = new Array(blockLengthWeeks + 1).fill(0);
    for (const p of phases) {
      for (let w = p.startWeek; w <= p.endWeek; w++) {
        if (w >= 1 && w <= blockLengthWeeks) coverage[w] += 1;
      }
    }
    const gaps: number[] = [];
    const overlaps: number[] = [];
    for (let w = 1; w <= blockLengthWeeks; w++) {
      if (coverage[w] === 0) gaps.push(w);
      if (coverage[w] > 1) overlaps.push(w);
    }
    if (gaps.length === 0 && overlaps.length === 0) return null;
    const parts: string[] = [];
    if (gaps.length > 0) {
      parts.push(`week${gaps.length === 1 ? "" : "s"} ${gaps.join(", ")} ${gaps.length === 1 ? "isn't" : "aren't"} covered by any phase`);
    }
    if (overlaps.length > 0) {
      parts.push(`week${overlaps.length === 1 ? "" : "s"} ${overlaps.join(", ")} ${overlaps.length === 1 ? "is" : "are"} covered by more than one phase`);
    }
    return parts.join("; ");
  }, [phases, blockLengthWeeks, deliveryMode]);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WorkoutOption[]>([]);

  useEffect(() => {
    const handle = setTimeout(async () => {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      const res = await fetch(`${workoutSearchEndpoint}?${params.toString()}`);
      const data = await res.json();
      setResults(data.workouts ?? []);
    }, 250);
    return () => clearTimeout(handle);
  }, [query, workoutSearchEndpoint]);

  function addWorkout(workout: WorkoutOption) {
    setAssignments((prev) => [...prev, { key: newKey(), workout_id: workout.id, workout_name: workout.name, days: [] }]);
  }

  function removeAssignment(index: number) {
    setAssignments((prev) => prev.filter((_, i) => i !== index));
  }

  function toggleDay(rowKey: string, day: number) {
    setAssignments((prev) =>
      prev.map((row) => {
        if (row.key === rowKey) {
          const has = row.days.includes(day);
          return { ...row, days: has ? row.days.filter((d) => d !== day) : [...row.days, day] };
        }
        return { ...row, days: row.days.filter((d) => d !== day) };
      })
    );
  }

  async function uploadCoverImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("image", file);
    const res = await fetch(`${apiBasePath}/${templateId}/cover-image`, { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed.");
    setCoverImageUrl(data.url);
    return data.url;
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        id: templateId,
        name,
        block_length_weeks: blockLengthWeeks,
        delivery_mode: deliveryMode,
        cover_image_url: coverImageUrl,
        assignments:
          deliveryMode === "open"
            ? assignments.slice(0, 1).map((row) => ({ workout_id: row.workout_id, day_of_week: null }))
            : assignments.flatMap((row) =>
                row.days
                  .filter((day): day is number => day != null)
                  .map((day) => ({ workout_id: row.workout_id, day_of_week: day }))
              ),
        phases:
          deliveryMode === "scheduled"
            ? phases.map((p, i) => ({ name: p.name, start_week: p.startWeek, end_week: p.endWeek, sort_order: i }))
            : [],
        ...(canEditUnder18Flag ? { is_under_18: isUnder18 } : {}),
        ...(canEditAccessAndPrice
          ? { access, price_gbp: access === "paid" ? Number(priceGBP) : null }
          : {}),
      };

      const res = await fetch(
        mode === "create" ? apiBasePath : `${apiBasePath}/${templateId}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed.");
      setSaved(true);
      markSaved({ name, blockLengthWeeks, isUnder18, assignments, phases, deliveryMode, access, priceGBP, coverImageUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const assignedDaysElsewhere = (rowKey: string) =>
    new Set(assignments.filter((r) => r.key !== rowKey).flatMap((r) => r.days));

  return (
    <div>
      {mode === "create" && (
        <div className={clinicStyles.card} style={{ marginBottom: 20 }}>
          <div className={clinicStyles.cardTitle}>Delivery</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              className={deliveryMode === "scheduled" ? clinicStyles.button : clinicStyles.buttonSecondary}
              style={{ width: "auto", padding: "0 20px" }}
              onClick={() => setDeliveryMode("scheduled")}
            >
              Scheduled
            </button>
            <button
              type="button"
              className={deliveryMode === "open" ? clinicStyles.button : clinicStyles.buttonSecondary}
              style={{ width: "auto", padding: "0 20px" }}
              onClick={() => setDeliveryMode("open")}
            >
              Open
            </button>
          </div>
          <p style={{ fontSize: 13.5, color: "var(--stone)", marginTop: 10, marginBottom: 0 }}>
            {deliveryMode === "scheduled"
              ? "A set number of weeks, sessions assigned to days, with week-by-week progression."
              : "A flat list of exercises with prescriptions set once -- no weeks, no days, done whenever."}
          </p>
        </div>
      )}

      <div className={clinicStyles.card} style={{ marginBottom: 20 }}>
        <div className={clinicStyles.cardTitle}>Access</div>
        {canEditAccessAndPrice ? (
          <>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                className={access === "paid" ? clinicStyles.button : clinicStyles.buttonSecondary}
                style={{ width: "auto", padding: "0 20px" }}
                onClick={() => setAccess("paid")}
              >
                Paid
              </button>
              <button
                type="button"
                className={access === "free" ? clinicStyles.button : clinicStyles.buttonSecondary}
                style={{ width: "auto", padding: "0 20px" }}
                onClick={() => setAccess("free")}
              >
                Free
              </button>
              {access === "paid" && (
                <div className={clinicStyles.field} style={{ marginBottom: 0, maxWidth: 140 }}>
                  <input
                    type="number"
                    min={1}
                    className={clinicStyles.input}
                    placeholder="Price, £"
                    value={priceGBP}
                    onChange={(e) => setPriceGBP(e.target.value)}
                  />
                </div>
              )}
            </div>
            <p style={{ fontSize: 13.5, color: "var(--stone)", marginTop: 10, marginBottom: 0 }}>
              {access === "paid"
                ? "When this template is linked to a shop listing, that price is what the patient pays through Stripe checkout."
                : "When this template is linked to a shop listing, the patient gets the programme straight away, with no payment step."}
            </p>
          </>
        ) : (
          <span className={`${clinicStyles.statusPill} ${clinicStyles.statusBrandNew}`}>
            {access === "paid" && initialPriceGBP != null ? `Paid, £${initialPriceGBP}` : access === "paid" ? "Paid" : "Free"}
          </span>
        )}
      </div>

      {canEditCoverImage && (
        <div className={clinicStyles.card} style={{ marginBottom: 20 }}>
          <div className={clinicStyles.cardTitle}>Cover image</div>
          <p style={{ fontSize: 13.5, color: "var(--stone)", marginBottom: 12 }}>
            Shown on this programme&apos;s shop card and detail page. Left blank, the shop shows a calm
            &ldquo;In construction&rdquo; placeholder instead of a broken image.
          </p>
          <ImageUploader existingUrl={coverImageUrl} onUpload={uploadCoverImage} />
        </div>
      )}

      {/* A light card, not bare fields on the canvas -- see the matching
          comment in ProgrammeBuilder.tsx. */}
      <div className={clinicStyles.card}>
        <div className={deliveryMode === "scheduled" ? clinicStyles.row2 : undefined}>
          <div className={clinicStyles.field}>
            <label className={clinicStyles.label}>Template name</label>
            <input
              className={clinicStyles.input}
              placeholder="e.g. Return to Running, Standard"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
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

        {canEditUnder18Flag ? (
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              fontSize: 13.5,
              color: "var(--graphite)",
              marginBottom: 0,
            }}
          >
            <input
              type="checkbox"
              checked={isUnder18}
              onChange={(e) => setIsUnder18(e.target.checked)}
              style={{ marginTop: 3 }}
            />
            <span>
              <b>Under-18 programme.</b> The account holder must be a parent or guardian, never the young
              athlete. Enrolling from this template will require guardian confirmation and the participant&apos;s
              name and age.
            </span>
          </label>
        ) : (
          isUnder18 && (
            <span className={`${clinicStyles.statusPill} ${clinicStyles.statusBrandNew}`}>Under-18 programme</span>
          )
        )}
      </div>

      {deliveryMode === "scheduled" && (
        <div className={clinicStyles.card}>
          <div className={clinicStyles.cardTitle}>Phases</div>
          <p style={{ fontSize: 13.5, color: "var(--stone)", marginTop: -6, marginBottom: 14 }}>
            Optional. Group weeks under a name, e.g. &ldquo;Protect &amp; restore&rdquo;, weeks 1-2, shown to David
            and the client on their dashboards.
          </p>

          {phases.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
              {phases.map((p) => (
                <div key={p.key} className={styles.phaseRow}>
                  <input
                    className={clinicStyles.input}
                    style={{ flex: 1 }}
                    placeholder="Phase name"
                    value={p.name}
                    onChange={(e) => updatePhase(p.key, { name: e.target.value })}
                  />
                  <span style={{ fontSize: 13, color: "var(--graphite)" }}>weeks</span>
                  <input
                    type="number"
                    min={1}
                    max={blockLengthWeeks}
                    className={clinicStyles.input}
                    style={{ width: 60 }}
                    value={p.startWeek}
                    onChange={(e) => updatePhase(p.key, { startWeek: Math.max(1, Number(e.target.value) || 1) })}
                  />
                  <span style={{ fontSize: 13, color: "var(--graphite)" }}>to</span>
                  <input
                    type="number"
                    min={1}
                    max={blockLengthWeeks}
                    className={clinicStyles.input}
                    style={{ width: 60 }}
                    value={p.endWeek}
                    onChange={(e) => updatePhase(p.key, { endWeek: Math.max(1, Number(e.target.value) || 1) })}
                  />
                  <button
                    type="button"
                    className={styles.phaseRemove}
                    onClick={() => removePhase(p.key)}
                    aria-label="Remove phase"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {phaseWarning && <p className={styles.phaseWarning}>{phaseWarning}, worth a look before saving.</p>}

          <button type="button" className={clinicStyles.buttonSecondary} style={{ width: "auto", padding: "0 18px" }} onClick={addPhase}>
            + Add phase
          </button>
        </div>
      )}

      {deliveryMode === "scheduled" ? (
        <PickerCanvas<WorkoutOption, WorkoutAssignment>
          pickerTitle="Workout library"
          searchQuery={query}
          onSearchChange={setQuery}
          searchPlaceholder="Search workouts…"
          pickerItems={results}
          getPickerItemKey={(w) => w.id}
          renderPickerItem={(w) => (
            <>
              <PickerThumb src={null} label={w.name} />
              <PickerResultBody name={w.name} />
            </>
          )}
          isAdded={(w) => assignments.some((a) => a.workout_id === w.id)}
          onAdd={addWorkout}
          pickerEmptyMessage="No workouts match. Build one in the Workouts library first."
          canvasTitle="Weekly schedule"
          canvasItems={assignments}
          getCanvasItemKey={(a) => a.key}
          renderCanvasItem={(a) => a.workout_name}
          onRemove={removeAssignment}
          canvasEmptyMessage="Add workouts from the left, then choose which day(s) each one runs."
          canvasRowExtra={(row) => {
            const takenElsewhere = assignedDaysElsewhere(row.key);
            return (
              <div>
                {showWorkoutEditLink && (
                  <Link
                    href={`/clinic/workouts/${row.workout_id}`}
                    target="_blank"
                    style={{ fontSize: 12, color: "var(--crimson)", display: "inline-block", marginBottom: 6 }}
                  >
                    Edit this workout →
                  </Link>
                )}
                <div className={styles.dayRow}>
                  {DAYS.map((d) => {
                    const active = row.days.includes(d.value);
                    const takenByOther = takenElsewhere.has(d.value);
                    return (
                      <button
                        key={d.value}
                        type="button"
                        className={`${styles.dayChip} ${active ? styles.dayChipActive : ""} ${
                          takenByOther ? styles.dayChipTaken : ""
                        }`}
                        onClick={() => toggleDay(row.key, d.value)}
                        title={
                          takenByOther ? "Currently assigned to another workout, click to move it here" : undefined
                        }
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          }}
        />
      ) : (
        <div className={clinicStyles.card}>
          <div className={clinicStyles.cardTitle}>The routine</div>
          <WorkoutEditorInline
            workoutId={openWorkoutId}
            mode={assignments.length > 0 ? "edit" : "create"}
            defaultBlockLengthWeeks={1}
            onSaved={(newName) =>
              setAssignments([{ key: openWorkoutId, workout_id: openWorkoutId, workout_name: newName, days: [null] }])
            }
          />
        </div>
      )}

      {error && (
        <div className={clinicStyles.error} style={{ marginTop: 16 }}>
          {error}
        </div>
      )}

      <button
        type="button"
        className={clinicStyles.button}
        style={{ marginTop: 20 }}
        disabled={
          saving ||
          !name.trim() ||
          (deliveryMode === "open" ? assignments.length === 0 : assignments.every((a) => a.days.length === 0)) ||
          (canEditAccessAndPrice && access === "paid" && !(Number(priceGBP) > 0))
        }
        onClick={handleSubmit}
      >
        {saving ? "Saving…" : mode === "edit" ? "Save changes" : saved ? "Saved" : "Save template"}
      </button>

      {mode === "create" && saved && (
        <div className={clinicStyles.shareLinkCard}>
          <div className={clinicStyles.smallLabel}>Saved</div>
          <div className={clinicStyles.shareLinkText}>
            &ldquo;{name}&rdquo; is in your Programme Template library, ready to assign to a Coach or use for a
            patient.
          </div>
        </div>
      )}
    </div>
  );
}
