"use client";

import { useMemo, useState } from "react";
import clinicStyles from "../clinic.module.css";
import type {
  CardioBaseline,
  CardioBaselineDiscipline,
  CardioBaselineUnit,
  CardioGoalCategory,
  GoalTarget,
} from "@/lib/cardioGoal";

type Props = {
  programmeId: string;
  startDate: string;
  goalTargets: GoalTarget[];
  initialCategory: CardioGoalCategory | null;
  initialGoalTargetId: string | null;
  initialTargetEventDate: string | null;
  initialBaselines: CardioBaseline[];
  // Server-computed suggestion per discipline, from the patient's own
  // completed cardio sessions -- see prefillBaseline() in cardioGoal.ts.
  // Null where nothing usable was found.
  prefillSuggestions: Partial<Record<CardioBaselineDiscipline, { value_number: number; value_unit: CardioBaselineUnit }>>;
};

const DISCIPLINE_LABEL: Record<CardioBaselineDiscipline, string> = { running: "Running", cycling: "Cycling" };

function disciplinesForName(name: string | null): CardioBaselineDiscipline[] {
  if (name === "Ironman 70.3" || name === "Full Ironman") return ["running", "cycling"];
  return ["running"];
}

function weeksBetween(startDate: string, targetDate: string | null): number | null {
  if (!targetDate) return null;
  const days = Math.round((new Date(targetDate).getTime() - new Date(startDate).getTime()) / 86400000);
  return Math.floor(days / 7);
}

// Phase 2/3 setup panel (see claude_code_instructions_goal_based_cardio.md)
// -- Ongoing/Event choice, goal target, and (Event only) target date and
// per-discipline capacity baseline. Deliberately separate from
// ProgrammeBuilder's own big save() -- this saves independently via its
// own endpoint, so it can't put the main weekly-calendar save at risk.
// Doesn't draft anything -- that's later, separate work.
export default function CardioGoalPanel({
  programmeId,
  startDate,
  goalTargets,
  initialCategory,
  initialGoalTargetId,
  initialTargetEventDate,
  initialBaselines,
  prefillSuggestions,
}: Props) {
  const [category, setCategory] = useState<CardioGoalCategory | "none">(initialCategory ?? "none");
  const [goalTargetId, setGoalTargetId] = useState(initialGoalTargetId ?? "");
  const [targetEventDate, setTargetEventDate] = useState(initialTargetEventDate ?? "");
  const [baselines, setBaselines] = useState<Record<CardioBaselineDiscipline, { value: string; unit: CardioBaselineUnit }>>(() => {
    const map = {} as Record<CardioBaselineDiscipline, { value: string; unit: CardioBaselineUnit }>;
    for (const b of initialBaselines) map[b.discipline] = { value: String(b.value_number), unit: b.value_unit };
    return map;
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredTargets = goalTargets.filter((g) => g.category === category);
  const selectedTarget = goalTargets.find((g) => g.id === goalTargetId) ?? null;
  const disciplines = useMemo(() => disciplinesForName(selectedTarget?.name ?? null), [selectedTarget]);
  const weeks = category === "event" ? weeksBetween(startDate, targetEventDate || null) : null;

  function useSuggested(discipline: CardioBaselineDiscipline) {
    const suggestion = prefillSuggestions[discipline];
    if (!suggestion) return;
    setBaselines((prev) => ({ ...prev, [discipline]: { value: String(suggestion.value_number), unit: suggestion.value_unit } }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        cardio_goal_category: category === "none" ? null : category,
        goal_target_id: category === "none" ? null : goalTargetId || null,
        target_event_date: category === "event" ? targetEventDate || null : null,
        baselines:
          category === "event"
            ? disciplines
                .filter((d) => baselines[d]?.value)
                .map((d) => {
                  const suggestion = prefillSuggestions[d];
                  const isSuggested =
                    suggestion && String(suggestion.value_number) === baselines[d].value && suggestion.value_unit === baselines[d].unit;
                  return {
                    discipline: d,
                    value_number: Number(baselines[d].value),
                    value_unit: baselines[d].unit,
                    source: isSuggested ? "prefilled" : "clinician_entered",
                  };
                })
            : [],
      };
      const res = await fetch(`/api/clinic/programmes/${programmeId}/cardio-goal`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed.");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={clinicStyles.card}>
      <div className={clinicStyles.cardTitle}>Cardio goal</div>
      <p style={{ fontSize: 13, color: "var(--stone)", marginBottom: 12 }}>
        Optional. Set this if this patient&apos;s cardio side is working toward something specific, rather than
        general strength/rehab content alone. Doesn&apos;t draft any sessions itself yet.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {(["none", "ongoing", "event"] as const).map((c) => (
          <button
            key={c}
            type="button"
            className={c === category ? clinicStyles.button : clinicStyles.buttonSecondary}
            onClick={() => {
              setCategory(c);
              setGoalTargetId("");
              setSaved(false);
            }}
          >
            {c === "none" ? "No cardio goal" : c === "ongoing" ? "Ongoing" : "Event"}
          </button>
        ))}
      </div>

      {category !== "none" && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12.5, color: "var(--stone)", display: "block", marginBottom: 4 }}>Goal target</label>
          <select
            value={goalTargetId}
            onChange={(e) => {
              setGoalTargetId(e.target.value);
              setSaved(false);
            }}
            style={{ width: "100%", padding: "8px 10px" }}
          >
            <option value="">Choose one</option>
            {filteredTargets.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {category === "event" && (
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12.5, color: "var(--stone)", display: "block", marginBottom: 4 }}>
              Target event date
            </label>
            <input
              type="date"
              value={targetEventDate}
              onChange={(e) => {
                setTargetEventDate(e.target.value);
                setSaved(false);
              }}
              style={{ padding: "8px 10px" }}
            />
            {weeks != null && (
              <span style={{ fontSize: 12.5, color: "var(--stone)", marginLeft: 10 }}>
                {weeks >= 0 ? `${weeks} weeks away` : "Date already passed"}
              </span>
            )}
          </div>

          {disciplines.map((d) => {
            const suggestion = prefillSuggestions[d];
            const current = baselines[d] ?? { value: "", unit: "minutes" as CardioBaselineUnit };
            return (
              <div key={d} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12.5, color: "var(--stone)", display: "block", marginBottom: 4 }}>
                  {DISCIPLINE_LABEL[d]} baseline: longest comfortable continuous effort right now, easy pace
                </label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="number"
                    min={0}
                    value={current.value}
                    onChange={(e) => {
                      setBaselines((prev) => ({ ...prev, [d]: { ...current, value: e.target.value } }));
                      setSaved(false);
                    }}
                    style={{ width: 90, padding: "8px 10px" }}
                  />
                  <select
                    value={current.unit}
                    onChange={(e) => {
                      setBaselines((prev) => ({ ...prev, [d]: { ...current, unit: e.target.value as CardioBaselineUnit } }));
                      setSaved(false);
                    }}
                    style={{ padding: "8px 10px" }}
                  >
                    <option value="minutes">minutes</option>
                    <option value="km">km</option>
                    <option value="miles">miles</option>
                  </select>
                  {suggestion && (
                    <button type="button" className={clinicStyles.buttonSecondary} onClick={() => useSuggested(d)}>
                      Use {suggestion.value_number} {suggestion.value_unit} (from their logged sessions)
                    </button>
                  )}
                </div>
                {!suggestion && (
                  <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                    No completed cardio sessions to suggest from yet; enter this from what you know.
                  </p>
                )}
              </div>
            );
          })}
        </>
      )}

      <button type="button" className={clinicStyles.button} onClick={save} disabled={saving}>
        {saving ? "Saving..." : "Save cardio goal"}
      </button>
      {saved && <span style={{ fontSize: 12.5, color: "var(--green)", marginLeft: 10 }}>Saved.</span>}
      {error && <p style={{ fontSize: 12.5, color: "var(--crimson)", marginTop: 8 }}>{error}</p>}
    </div>
  );
}
