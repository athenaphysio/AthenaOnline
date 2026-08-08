"use client";

import {
  CARDIO_MODALITIES,
  CARDIO_REST_TYPES,
  CARDIO_STRUCTURES,
  CARDIO_TIERS,
  resizeIntensities,
  type CardioBlockDetail,
  type CardioModality,
  type CardioRestMode,
  type CardioRestType,
  type CardioStructure,
  type CardioTier,
} from "@/lib/cardioBlock";
import styles from "./CardioBlockEditor.module.css";

type Props = {
  cardio: CardioBlockDetail;
  onChange: (patch: Partial<CardioBlockDetail>) => void;
};

function numberOrNull(value: string): number | null {
  return value === "" ? null : Number(value);
}

// Minutes + seconds pair that reads/writes a single total-seconds field --
// covers both a 20 minute steady-state duration and a 30 second interval
// work bout with the same control.
function DurationInput({
  seconds,
  onChange,
}: {
  seconds: number | null;
  onChange: (seconds: number | null) => void;
}) {
  const mins = seconds != null ? Math.floor(seconds / 60) : null;
  const secs = seconds != null ? seconds % 60 : null;

  function update(nextMins: number | null, nextSecs: number | null) {
    if (nextMins == null && nextSecs == null) {
      onChange(null);
      return;
    }
    onChange((nextMins ?? 0) * 60 + (nextSecs ?? 0));
  }

  return (
    <div className={styles.durationPair}>
      <input
        type="number"
        min={0}
        placeholder="0"
        value={mins ?? ""}
        onChange={(e) => update(e.target.value === "" ? null : Number(e.target.value), secs)}
      />
      <span className={styles.durationUnit}>min</span>
      <input
        type="number"
        min={0}
        max={59}
        placeholder="0"
        value={secs ?? ""}
        onChange={(e) => update(mins, e.target.value === "" ? null : Number(e.target.value))}
      />
      <span className={styles.durationUnit}>sec</span>
    </div>
  );
}

// A shared cardio block's own fields, expanded inline wherever that block is
// referenced -- same role BlockGroupEditor plays for a Block. Editing here
// changes the block itself, same as editing any other shared library row.
export default function CardioBlockEditor({ cardio: d, onChange }: Props) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <input
          className={styles.nameInput}
          value={d.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        <span className={styles.blockTag}>Shared cardio block, changes apply everywhere it&apos;s used</span>
      </div>

      <div className={styles.row2}>
        <div className={styles.field}>
          <div className={styles.fieldLabel}>Modality</div>
          <select
            className={styles.select}
            value={d.modality}
            onChange={(e) => onChange({ modality: e.target.value as CardioModality })}
          >
            {CARDIO_MODALITIES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        {d.modality === "other" && (
          <div className={styles.field}>
            <div className={styles.fieldLabel}>Which modality</div>
            <input
              className={styles.input}
              value={d.modality_other ?? ""}
              onChange={(e) => onChange({ modality_other: e.target.value || null })}
            />
          </div>
        )}
      </div>

      <div className={styles.structureTabs}>
        {CARDIO_STRUCTURES.map((s) => (
          <button
            key={s.value}
            type="button"
            className={`${styles.structureTab} ${d.structure === s.value ? styles.structureTabActive : ""}`}
            onClick={() => onChange({ structure: s.value as CardioStructure })}
          >
            {s.label}
          </button>
        ))}
      </div>

      {d.structure === "steady_state" ? (
        <>
          <div className={styles.field}>
            <div className={styles.fieldLabel}>Duration (required)</div>
            <DurationInput
              seconds={d.steady_duration_seconds}
              onChange={(v) => onChange({ steady_duration_seconds: v })}
            />
          </div>
          <div className={styles.grid}>
            <div>
              <div className={styles.fieldLabel}>Distance (m)</div>
              <input
                type="number"
                className={styles.input}
                value={d.steady_distance_m ?? ""}
                onChange={(e) => onChange({ steady_distance_m: numberOrNull(e.target.value) })}
              />
            </div>
            <div>
              <div className={styles.fieldLabel}>Intensity (%)</div>
              <input
                type="number"
                className={styles.input}
                value={d.steady_intensity_percent ?? ""}
                onChange={(e) => onChange({ steady_intensity_percent: numberOrNull(e.target.value) })}
              />
            </div>
            <div>
              <div className={styles.fieldLabel}>Target HR zone</div>
              <input
                className={styles.input}
                value={d.steady_hr_zone ?? ""}
                onChange={(e) => onChange({ steady_hr_zone: e.target.value || null })}
              />
            </div>
            <div>
              <div className={styles.fieldLabel}>Speed / pace</div>
              <input
                className={styles.input}
                value={d.steady_pace ?? ""}
                onChange={(e) => onChange({ steady_pace: e.target.value || null })}
              />
            </div>
            <div>
              <div className={styles.fieldLabel}>Power (watts)</div>
              <input
                type="number"
                className={styles.input}
                value={d.steady_power_watts ?? ""}
                onChange={(e) => onChange({ steady_power_watts: numberOrNull(e.target.value) })}
              />
            </div>
            <div>
              <div className={styles.fieldLabel}>Cadence</div>
              <input
                type="number"
                className={styles.input}
                value={d.steady_cadence ?? ""}
                onChange={(e) => onChange({ steady_cadence: numberOrNull(e.target.value) })}
              />
            </div>
            <div>
              <div className={styles.fieldLabel}>Incline / resistance</div>
              <input
                className={styles.input}
                value={d.steady_incline_resistance ?? ""}
                onChange={(e) => onChange({ steady_incline_resistance: e.target.value || null })}
              />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className={styles.row2}>
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Number of reps</div>
              <input
                type="number"
                min={0}
                className={styles.input}
                value={d.interval_reps ?? ""}
                onChange={(e) => {
                  const reps = e.target.value === "" ? null : Math.max(0, Number(e.target.value));
                  onChange({
                    interval_reps: reps,
                    interval_intensities_percent: resizeIntensities(d.interval_intensities_percent, reps ?? 0),
                  });
                }}
              />
            </div>
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Work duration</div>
              <DurationInput
                seconds={d.interval_work_seconds}
                onChange={(v) => onChange({ interval_work_seconds: v })}
              />
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.fieldLabel}>Rest</div>
            <select
              className={styles.select}
              value={d.interval_rest_mode ?? "fixed_time"}
              onChange={(e) => onChange({ interval_rest_mode: e.target.value as CardioRestMode })}
            >
              <option value="fixed_time">Fixed time</option>
              <option value="percent_recovered">Until X% recovered</option>
            </select>
          </div>

          {d.interval_rest_mode === "percent_recovered" ? (
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Recovered to (%)</div>
              <input
                type="number"
                min={0}
                max={100}
                className={styles.input}
                value={d.interval_rest_percent_recovered ?? ""}
                onChange={(e) => onChange({ interval_rest_percent_recovered: numberOrNull(e.target.value) })}
              />
            </div>
          ) : (
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Rest duration</div>
              <DurationInput
                seconds={d.interval_rest_seconds}
                onChange={(v) => onChange({ interval_rest_seconds: v })}
              />
            </div>
          )}

          <div className={styles.row2}>
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Rest type</div>
              <select
                className={styles.select}
                value={d.interval_rest_type ?? ""}
                onChange={(e) => onChange({ interval_rest_type: (e.target.value || null) as CardioRestType | null })}
              >
                <option value="">Not set</option>
                {CARDIO_REST_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            {d.interval_rest_type === "other" && (
              <div className={styles.field}>
                <div className={styles.fieldLabel}>Which rest type</div>
                <input
                  className={styles.input}
                  value={d.interval_rest_type_other ?? ""}
                  onChange={(e) => onChange({ interval_rest_type_other: e.target.value || null })}
                />
              </div>
            )}
          </div>

          {d.interval_reps != null && d.interval_reps > 0 && (
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Intensity per rep (%) -- can step up or down</div>
              <div className={styles.repsRow}>
                {Array.from({ length: d.interval_reps }, (_, i) => i).map((i) => (
                  <div key={i} className={styles.repCell}>
                    <span className={styles.repCellLabel}>Rep {i + 1}</span>
                    <input
                      type="number"
                      className={styles.repCellInput}
                      value={d.interval_intensities_percent?.[i] ?? ""}
                      onChange={(e) => {
                        const next = resizeIntensities(d.interval_intensities_percent, d.interval_reps ?? 0);
                        next[i] = e.target.value === "" ? null : Number(e.target.value);
                        onChange({ interval_intensities_percent: next });
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className={styles.field}>
        <div className={styles.fieldLabel}>Rationale</div>
        <textarea
          className={styles.textarea}
          value={d.rationale ?? ""}
          onChange={(e) => onChange({ rationale: e.target.value || null })}
          placeholder="Why this block exists and what it's building towards -- shown to the client."
        />
      </div>

      {d.category === "return_to_run" && (
        <>
          <div className={styles.field}>
            <div className={styles.fieldLabel}>Entry criteria (shown to you before adding this to a patient&apos;s programme)</div>
            <textarea
              className={styles.textarea}
              value={d.entry_criteria ?? ""}
              onChange={(e) => onChange({ entry_criteria: e.target.value || null })}
              placeholder="What has to be true of this patient before this stage is appropriate."
            />
          </div>
          <div className={styles.field}>
            <div className={styles.fieldLabel}>Stop / regression rule (shown to the patient alongside this block)</div>
            <textarea
              className={styles.textarea}
              value={d.stop_rule ?? ""}
              onChange={(e) => onChange({ stop_rule: e.target.value || null })}
              placeholder="What should make the patient stop and hold, or step back a stage."
            />
          </div>
        </>
      )}

      {(d.category === "running_progression" || d.category === "cycling_progression") && (
        <>
          <div className={styles.field}>
            <div className={styles.fieldLabel}>Tier</div>
            <select
              className={styles.select}
              value={d.tier ?? ""}
              onChange={(e) => onChange({ tier: (e.target.value || null) as CardioTier | null })}
            >
              <option value="">Not set</option>
              {CARDIO_TIERS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <div className={styles.fieldLabel}>Coaching note (shown to the patient alongside this block)</div>
            <textarea
              className={styles.textarea}
              value={d.coaching_note ?? ""}
              onChange={(e) => onChange({ coaching_note: e.target.value || null })}
              placeholder="A standing cue worth repeating across this whole category, e.g. on cadence."
            />
          </div>
        </>
      )}
    </div>
  );
}
