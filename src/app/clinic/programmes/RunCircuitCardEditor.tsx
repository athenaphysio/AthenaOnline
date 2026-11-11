"use client";

import { useEffect, useState } from "react";
import {
  estimateMinutes,
  formatSeconds,
  type CardCircuit,
  type CardCircuitBlock,
  type CircuitLibrary,
  type CircuitRoundRun,
} from "@/lib/runCircuit";
import CircuitExerciseEditor, { type ExerciseChoice } from "../run-circuits/CircuitExerciseEditor";
import clinicStyles from "../clinic.module.css";
import styles from "./PlanCardEditor.module.css";

type Props = {
  circuit: CardCircuit;
  onChange: (next: CardCircuit) => void;
};

function numberOrUndefined(v: string): number | undefined {
  if (v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function NumberField({
  label,
  value,
  onChange,
  step = 1,
  hint,
  width = 90,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  step?: number;
  hint?: string;
  width?: number;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12, color: "var(--graphite)" }}>
      {label}
      <input
        type="number"
        step={step}
        className={clinicStyles.smallInput}
        style={{ width }}
        value={value ?? ""}
        onChange={(e) => onChange(numberOrUndefined(e.target.value))}
      />
      {hint && <span style={{ fontSize: 11, color: "var(--muted)" }}>{hint}</span>}
    </label>
  );
}

// A client's Run Circuit card in the programme builder. Everything here is
// this client's own copy: the run and walk for each block, the rounds, the
// warm up and cool down, and the exercises inside each block. "Save as
// default" writes a block's exercises back to the Run Circuit library for
// future plans; programmes already built are never changed by it.
export default function RunCircuitCardEditor({ circuit, onChange }: Props) {
  const [exerciseLibrary, setExerciseLibrary] = useState<ExerciseChoice[]>([]);
  const [circuitLibrary, setCircuitLibrary] = useState<CircuitLibrary | null>(null);
  const [message, setMessage] = useState<Record<number, string>>({});
  const [openRounds, setOpenRounds] = useState<Record<number, boolean>>({});

  useEffect(() => {
    let live = true;
    fetch("/api/clinic/exercises")
      .then((r) => (r.ok ? r.json() : { exercises: [] }))
      .then((j: { exercises: ExerciseChoice[] }) => live && setExerciseLibrary(j.exercises ?? []))
      .catch(() => undefined);
    fetch("/api/clinic/run-circuits")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: CircuitLibrary | null) => live && setCircuitLibrary(j))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  function updateBlock(i: number, patch: Partial<CardCircuitBlock>) {
    onChange({ ...circuit, blocks: circuit.blocks.map((b, idx) => (idx === i ? { ...b, ...patch } : b)) });
  }

  function updateRound(i: number, round: number, patch: CircuitRoundRun) {
    const block = circuit.blocks[i];
    const byRound = Array.from({ length: circuit.rounds }, (_, r) => ({ ...(block.by_round?.[r] ?? {}) }));
    byRound[round - 1] = { ...byRound[round - 1], ...patch };
    for (const r of byRound) for (const k of Object.keys(r) as (keyof CircuitRoundRun)[]) if (r[k] === undefined) delete r[k];
    const anyChange = byRound.some((r) => Object.keys(r).length > 0);
    updateBlock(i, { by_round: anyChange ? byRound : undefined });
  }

  function moveBlock(i: number, by: number) {
    const j = i + by;
    if (j < 0 || j >= circuit.blocks.length) return;
    const next = [...circuit.blocks];
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ ...circuit, blocks: next });
  }

  function addBlock(id: string) {
    const lib = circuitLibrary?.blocks.find((b) => b.id === id);
    if (!lib) return;
    const last = circuit.blocks[circuit.blocks.length - 1];
    onChange({
      ...circuit,
      blocks: [
        ...circuit.blocks,
        {
          block: lib.name,
          library_block_id: lib.id,
          exercises: lib.exercises.map((e) => ({ ...e })),
          run_seconds: last?.run_seconds ?? 60,
          effort: last?.effort ?? (last?.speed_kmh == null ? 5 : undefined),
          speed_kmh: last?.speed_kmh,
          incline_pct: last?.incline_pct,
          walk_seconds: last?.walk_seconds ?? 60,
        },
      ],
    });
  }

  async function saveAsDefault(i: number) {
    const block = circuit.blocks[i];
    if (!block.library_block_id) return;
    setMessage((m) => ({ ...m, [i]: "Saving…" }));
    const res = await fetch(`/api/clinic/run-circuits/${block.library_block_id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "block", exercises: block.exercises }),
    });
    setMessage((m) => ({
      ...m,
      [i]: res.ok ? `Saved as the default for ${block.block}. Programmes already built keep their own copy.` : "That didn't save to the library.",
    }));
  }

  function resetToLibrary(i: number) {
    const block = circuit.blocks[i];
    const lib = circuitLibrary?.blocks.find((b) => b.id === block.library_block_id);
    if (!lib) return;
    updateBlock(i, { exercises: lib.exercises.map((e) => ({ ...e })) });
    setMessage((m) => ({ ...m, [i]: "Back to the library version." }));
  }

  const walkField = (key: "warm_up" | "cool_down", label: string) => {
    const w = circuit[key];
    return (
      <div className={clinicStyles.field}>
        <label className={clinicStyles.label}>{label}</label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="number"
            min={0}
            max={60}
            className={clinicStyles.smallInput}
            style={{ width: 70 }}
            value={w?.minutes ?? 0}
            onChange={(e) => {
              const minutes = Math.max(0, Math.min(60, Number(e.target.value) || 0));
              onChange({ ...circuit, [key]: minutes > 0 ? { minutes, detail: w?.detail ?? "" } : undefined });
            }}
          />
          <span style={{ fontSize: 13 }}>min</span>
          <input
            className={clinicStyles.input}
            placeholder="What to do, for example brisk walk building to an easy jog"
            value={w?.detail ?? ""}
            disabled={!w}
            onChange={(e) => w && onChange({ ...circuit, [key]: { ...w, detail: e.target.value } })}
          />
        </div>
      </div>
    );
  };

  const unusedBlocks = circuitLibrary?.blocks ?? [];

  return (
    <div>
      <div className={clinicStyles.row2}>
        <div className={clinicStyles.field}>
          <label className={clinicStyles.label}>Rounds</label>
          <input
            type="number"
            min={1}
            max={10}
            className={clinicStyles.input}
            value={circuit.rounds}
            onChange={(e) => {
              const rounds = Math.max(1, Math.min(10, Number(e.target.value) || 1));
              onChange({ ...circuit, rounds, blocks: circuit.blocks.map((b) => ({ ...b, by_round: b.by_round?.slice(0, rounds) })) });
            }}
          />
        </div>
        <div className={clinicStyles.field}>
          <label className={clinicStyles.label}>About</label>
          <p className={clinicStyles.notice} style={{ margin: "8px 0 0" }}>
            {circuit.blocks.length} block{circuit.blocks.length === 1 ? "" : "s"}, roughly {estimateMinutes(circuit)} min
            {circuit.set ? `, from ${circuit.set}` : ""}
          </p>
        </div>
      </div>

      {walkField("warm_up", "Warm up")}

      {circuit.blocks.map((b, i) => {
        const missing = !b.library_block_id && b.exercises.length === 0;
        return (
          <div key={i} style={{ border: "1px solid var(--mist)", borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <strong style={{ fontSize: 15 }}>
                {i + 1}. {b.block}
              </strong>
              <div className={styles.actions}>
                <button type="button" className={styles.smallButton} onClick={() => moveBlock(i, -1)} disabled={i === 0} aria-label="Move block up">
                  &uarr;
                </button>
                <button type="button" className={styles.smallButton} onClick={() => moveBlock(i, 1)} disabled={i === circuit.blocks.length - 1} aria-label="Move block down">
                  &darr;
                </button>
                <button
                  type="button"
                  className={styles.deleteButton}
                  onClick={() => onChange({ ...circuit, blocks: circuit.blocks.filter((_, idx) => idx !== i) })}
                  disabled={circuit.blocks.length === 1}
                >
                  Remove
                </button>
              </div>
            </div>
            {missing && (
              <div className={clinicStyles.warningCard} style={{ marginTop: 8 }}>
                <div className={clinicStyles.warningItem}>
                  This block was not found in the Run Circuit library, so it has no exercises. Add them here, or remove the block.
                </div>
              </div>
            )}

            <div style={{ fontSize: 12.5, fontWeight: 600, margin: "10px 0 6px", color: "var(--graphite)" }}>Run, set by the plan</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <NumberField label="Run (seconds)" value={b.run_seconds} hint={formatSeconds(b.run_seconds)} onChange={(v) => updateBlock(i, { run_seconds: Math.max(5, v ?? 5) })} />
              <NumberField label="Effort /10" value={b.effort} onChange={(v) => updateBlock(i, { effort: v })} width={70} />
              <NumberField label="Speed km/h" value={b.speed_kmh} step={0.1} onChange={(v) => updateBlock(i, { speed_kmh: v })} width={80} />
              <NumberField label="Incline %" value={b.incline_pct} step={0.5} onChange={(v) => updateBlock(i, { incline_pct: v })} width={70} />
              <NumberField label="Walk after (seconds)" value={b.walk_seconds} hint={formatSeconds(b.walk_seconds)} onChange={(v) => updateBlock(i, { walk_seconds: Math.max(0, v ?? 0) })} />
            </div>
            <input
              className={clinicStyles.input}
              style={{ marginTop: 8 }}
              placeholder="Note on the run (optional)"
              value={b.note ?? ""}
              onChange={(e) => updateBlock(i, { note: e.target.value || undefined })}
            />

            {circuit.rounds > 1 && (
              <div style={{ marginTop: 8 }}>
                <button type="button" className={styles.backLink} onClick={() => setOpenRounds((o) => ({ ...o, [i]: !o[i] }))}>
                  {openRounds[i] ? "Hide round by round changes" : b.by_round?.length ? "Round by round changes (set)" : "Change the run for one round"}
                </button>
                {openRounds[i] &&
                  Array.from({ length: circuit.rounds }, (_, r) => r + 1).map((round) => {
                    const change = b.by_round?.[round - 1] ?? {};
                    return (
                      <div key={round} style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginTop: 8 }}>
                        <span style={{ fontSize: 13, width: 64 }}>Round {round}</span>
                        <NumberField label="Run (s)" value={change.run_seconds} onChange={(v) => updateRound(i, round, { run_seconds: v })} width={75} />
                        <NumberField label="Effort" value={change.effort} onChange={(v) => updateRound(i, round, { effort: v })} width={60} />
                        <NumberField label="km/h" value={change.speed_kmh} step={0.1} onChange={(v) => updateRound(i, round, { speed_kmh: v })} width={70} />
                        <NumberField label="Walk (s)" value={change.walk_seconds} onChange={(v) => updateRound(i, round, { walk_seconds: v })} width={75} />
                      </div>
                    );
                  })}
                {openRounds[i] && <p style={{ fontSize: 12, color: "var(--muted)", margin: "6px 0 0" }}>Leave a box empty to keep the block&apos;s own value for that round.</p>}
              </div>
            )}

            <div style={{ fontSize: 12.5, fontWeight: 600, margin: "14px 0 6px", color: "var(--graphite)" }}>Exercises, for this client</div>
            <CircuitExerciseEditor exercises={b.exercises} library={exerciseLibrary} onChange={(next) => updateBlock(i, { exercises: next })} />
            <div className={styles.actions} style={{ marginTop: 8 }}>
              <button type="button" className={styles.smallButton} onClick={() => saveAsDefault(i)} disabled={!b.library_block_id}>
                Save as default
              </button>
              <button type="button" className={styles.smallButton} onClick={() => resetToLibrary(i)} disabled={!b.library_block_id || !circuitLibrary}>
                Use the library version
              </button>
            </div>
            {message[i] && <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "6px 0 0" }}>{message[i]}</p>}
          </div>
        );
      })}

      {unusedBlocks.length > 0 && (
        <select className={clinicStyles.input} value="" onChange={(e) => e.target.value && addBlock(e.target.value)} style={{ marginBottom: 12 }}>
          <option value="">+ Add a block from the library</option>
          {unusedBlocks.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      )}

      {walkField("cool_down", "Cool down")}
    </div>
  );
}
