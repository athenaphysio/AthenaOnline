// Run Circuits, for return to running clients.
//
// Dr David Silver PhD builds named circuit blocks from his own exercise
// library (the exercises and their doses are his alone), and saves phase
// sets of blocks. Plan code from the Programme Builder project only chooses
// which blocks, in what order, how many rounds, and the run in front of each
// block plus the walk after it. Plan code can never add or change an
// exercise inside a block: the validator in athenaPlan.ts rejects it.
//
// When plan code is built into a client's programme, each block's exercises
// are copied onto that client's session card, so later changes to the
// library never quietly change a programme a client is already following.
// David can edit the client's copy, and "Save as default" writes it back to
// the library block. Client-safe: no database here.

export const CIRCUIT_DOSE_TYPES = ["reps", "contacts", "time"] as const;
export type CircuitDoseType = (typeof CIRCUIT_DOSE_TYPES)[number];

export const DOSE_LABEL: Record<CircuitDoseType, string> = {
  reps: "reps",
  contacts: "contacts",
  time: "seconds",
};

/** One exercise inside a circuit block, with David's own dose. */
export type CircuitExercise = {
  exercise_id: string;
  /** The library name, carried so the builder can show it without a lookup. */
  name: string;
  dose_type: CircuitDoseType;
  /** Reps, contacts, or seconds for a timed exercise. 0 means the dose is
   * still to be confirmed by Dr David Silver PhD. */
  amount: number;
  /** Each side, for single leg or single arm work. */
  per_side: boolean;
  note: string;
};

/** A circuit block in the library. */
export type LibraryCircuitBlock = {
  id: string;
  name: string;
  notes: string;
  exercises: CircuitExercise[];
};

/** A phase set: a named, ordered list of blocks. */
export type LibraryCircuitSet = {
  id: string;
  name: string;
  notes: string;
  block_ids: string[];
};

export type CircuitLibrary = { blocks: LibraryCircuitBlock[]; sets: LibraryCircuitSet[] };

/** The run in front of a block and the walk after it. */
export type CircuitRun = {
  run_seconds: number;
  /** Effort out of 10. */
  effort?: number;
  /** Treadmill speed. */
  speed_kmh?: number;
  /** Treadmill incline, as a percentage. */
  incline_pct?: number;
  walk_seconds: number;
  note?: string;
};

/** A change to the run for one round only (round 2, say). */
export type CircuitRoundRun = Partial<CircuitRun>;

/** One block as plan code lists it. */
export type PlanCircuitBlock = CircuitRun & {
  block: string;
  /** Optional, one entry per round: whatever is given replaces the run for that round. */
  by_round?: CircuitRoundRun[];
};

export type CircuitWalk = { minutes: number; detail?: string };

/** The circuit part of a run_circuit session in plan code. */
export type PlanCircuit = {
  /** Optional: the phase set these blocks come from, for the record. */
  set?: string;
  rounds: number;
  warm_up?: CircuitWalk;
  cool_down?: CircuitWalk;
  blocks: PlanCircuitBlock[];
};

/** The same circuit on a client's session card, with the block exercises copied in. */
export type CardCircuitBlock = PlanCircuitBlock & {
  /** The library block it was copied from, for "Save as default". Null if it has gone. */
  library_block_id: string | null;
  exercises: CircuitExercise[];
};

export type CardCircuit = Omit<PlanCircuit, "blocks"> & { blocks: CardCircuitBlock[] };

/** What the client logs at the end of a Run Circuit. */
export type CircuitLog = {
  blocks_planned: number;
  blocks_completed: number;
  run_seconds: number;
  flare_up: boolean;
  symptoms: string;
  /** "I wasn't sure I was getting some of it right": a sign of attention, never an alert. */
  not_sure: boolean;
};

export function normaliseName(name: string): string {
  return name.trim().toLowerCase();
}

/** The run for one block in one round (1 based), with any round change applied. */
export function runForRound(block: PlanCircuitBlock, round: number): CircuitRun {
  const base: CircuitRun = {
    run_seconds: block.run_seconds,
    effort: block.effort,
    speed_kmh: block.speed_kmh,
    incline_pct: block.incline_pct,
    walk_seconds: block.walk_seconds,
    note: block.note,
  };
  const change = block.by_round?.[round - 1];
  if (!change) return base;
  const out = { ...base };
  for (const k of Object.keys(change) as (keyof CircuitRun)[]) {
    if (change[k] !== undefined) (out as Record<string, unknown>)[k] = change[k];
  }
  return out;
}

export function formatSeconds(total: number): string {
  const s = Math.max(0, Math.round(total));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r} sec`;
  if (r === 0) return `${m} min`;
  return `${m} min ${r} sec`;
}

export function clockText(total: number): string {
  const s = Math.max(0, Math.round(total));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** "Run 3 min at effort 5 out of 10" or "Run 3 min at 9 km/h, 1% incline". */
export function runText(run: CircuitRun): string {
  const how: string[] = [];
  if (run.speed_kmh != null) how.push(`${run.speed_kmh} km/h`);
  if (run.incline_pct != null && run.incline_pct > 0) how.push(`${run.incline_pct}% incline`);
  if (run.effort != null) how.push(`effort ${run.effort} out of 10`);
  return `Run ${formatSeconds(run.run_seconds)}${how.length ? ` at ${how.join(", ")}` : ""}`;
}

export function doseText(ex: Pick<CircuitExercise, "dose_type" | "amount" | "per_side">): string {
  if (!ex.amount) return "dose to be confirmed";
  const unit = ex.dose_type === "time" ? (ex.amount === 1 ? "second" : "seconds") : ex.dose_type === "contacts" ? (ex.amount === 1 ? "contact" : "contacts") : ex.amount === 1 ? "rep" : "reps";
  return `${ex.amount} ${unit}${ex.per_side ? " each side" : ""}`;
}

/** Rough total time, for the card's overview: walks, runs and timed exercises only. */
export function estimateMinutes(circuit: PlanCircuit | CardCircuit): number {
  let seconds = (circuit.warm_up?.minutes ?? 0) * 60 + (circuit.cool_down?.minutes ?? 0) * 60;
  for (let round = 1; round <= circuit.rounds; round++) {
    for (const block of circuit.blocks) {
      const run = runForRound(block, round);
      seconds += run.run_seconds + run.walk_seconds;
      const exercises = "exercises" in block ? (block as CardCircuitBlock).exercises : [];
      // Roughly 3 seconds a rep or contact, plus a short changeover.
      for (const ex of exercises) seconds += (ex.dose_type === "time" ? ex.amount : ex.amount * 3) * (ex.per_side ? 2 : 1) + 15;
    }
  }
  return Math.max(1, Math.round(seconds / 60));
}

/** Total planned run time across every round. */
export function plannedRunSeconds(circuit: PlanCircuit | CardCircuit): number {
  let seconds = 0;
  for (let round = 1; round <= circuit.rounds; round++) {
    for (const block of circuit.blocks) seconds += runForRound(block, round).run_seconds;
  }
  return seconds;
}

/**
 * Copies each block's exercises from the library onto a client's card.
 * Name matching ignores case and spaces at either end, the same rule the
 * validator uses. A block that is no longer in the library keeps an empty
 * exercise list, which the builder flags.
 */
export function circuitFromLibrary(circuit: PlanCircuit, library: CircuitLibrary): CardCircuit {
  const byName = new Map(library.blocks.map((b) => [normaliseName(b.name), b]));
  return {
    ...circuit,
    blocks: circuit.blocks.map((b) => {
      const lib = byName.get(normaliseName(b.block));
      return {
        ...b,
        block: lib?.name ?? b.block,
        by_round: b.by_round?.map((r) => ({ ...r })),
        library_block_id: lib?.id ?? null,
        exercises: lib ? lib.exercises.map((e) => ({ ...e })) : [],
      };
    }),
  };
}

/** Plain steps for the PDF, the legacy calendar and anywhere else that only reads steps. */
export function circuitSteps(circuit: PlanCircuit | CardCircuit): { label: string; detail: string }[] {
  const steps: { label: string; detail: string }[] = [];
  if (circuit.warm_up) steps.push({ label: "Warm up", detail: `${circuit.warm_up.minutes} min${circuit.warm_up.detail ? `, ${circuit.warm_up.detail}` : ""}` });
  for (let round = 1; round <= circuit.rounds; round++) {
    for (const block of circuit.blocks) {
      const run = runForRound(block, round);
      const exercises = "exercises" in block ? (block as CardCircuitBlock).exercises : [];
      const parts = [runText(run)];
      if (exercises.length) parts.push(exercises.map((e) => `${e.name} ${doseText(e)}`).join(", "));
      if (run.walk_seconds > 0) parts.push(`walk ${formatSeconds(run.walk_seconds)}`);
      steps.push({ label: `Round ${round}, ${block.block}`, detail: parts.join("; ") });
    }
  }
  if (circuit.cool_down) steps.push({ label: "Cool down", detail: `${circuit.cool_down.minutes} min${circuit.cool_down.detail ? `, ${circuit.cool_down.detail}` : ""}` });
  return steps;
}

// Cleans a library block's exercise list as it arrives from the clinic
// screens. Anything malformed is dropped rather than stored.
export function cleanCircuitExercises(value: unknown): CircuitExercise[] {
  if (!Array.isArray(value)) return [];
  const out: CircuitExercise[] = [];
  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.exercise_id !== "string" || !r.exercise_id.trim()) continue;
    const doseType = CIRCUIT_DOSE_TYPES.includes(r.dose_type as CircuitDoseType) ? (r.dose_type as CircuitDoseType) : "reps";
    const amount = typeof r.amount === "number" && Number.isFinite(r.amount) ? Math.max(0, Math.min(3600, Math.round(r.amount))) : 10;
    out.push({
      exercise_id: r.exercise_id.trim(),
      name: typeof r.name === "string" ? r.name.trim() : "",
      dose_type: doseType,
      amount,
      per_side: r.per_side === true,
      note: typeof r.note === "string" ? r.note.trim().slice(0, 500) : "",
    });
  }
  return out.slice(0, 20);
}
