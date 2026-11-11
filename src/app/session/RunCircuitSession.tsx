"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./TodaySession.module.css";
import VoiceNoteButton from "./VoiceNoteButton";
import FlareBox from "./FlareBox";
import {
  clockText,
  doseText,
  estimateMinutes,
  formatSeconds,
  plannedRunSeconds,
  runForRound,
  runText,
  type CardCircuit,
  type CardCircuitBlock,
  type CircuitExercise,
  type CircuitRun,
} from "@/lib/runCircuit";

export type ClientCircuitExercise = CircuitExercise & {
  /** Why the exercise is there, from the exercise library. */
  why: string;
  video: { embedUrl: string; aspectRatio: number } | null;
  illustration: string | null;
};

export type ClientCircuitBlock = Omit<CardCircuitBlock, "exercises"> & { exercises: ClientCircuitExercise[] };
export type ClientCircuit = Omit<CardCircuit, "blocks"> & { blocks: ClientCircuitBlock[] };

type Step =
  | { kind: "warm_up" | "cool_down"; seconds: number; detail: string }
  | { kind: "run"; round: number; block: ClientCircuitBlock; run: CircuitRun }
  | { kind: "exercise"; round: number; block: ClientCircuitBlock; exercise: ClientCircuitExercise; index: number; count: number; endsBlock: boolean }
  | { kind: "walk"; round: number; block: ClientCircuitBlock; seconds: number };

type Props = {
  programmeId: string;
  workoutId: string;
  weekNumber: number;
  dayNumber: number;
  title: string;
  summary: string;
  notes: string;
  circuit: ClientCircuit;
  done: boolean;
  flareRuleText: string | null;
};

function buildSteps(circuit: ClientCircuit): Step[] {
  const steps: Step[] = [];
  if (circuit.warm_up) steps.push({ kind: "warm_up", seconds: circuit.warm_up.minutes * 60, detail: circuit.warm_up.detail ?? "" });
  for (let round = 1; round <= circuit.rounds; round++) {
    for (const block of circuit.blocks) {
      const run = runForRound(block, round);
      steps.push({ kind: "run", round, block, run });
      block.exercises.forEach((exercise, index) => {
        steps.push({
          kind: "exercise",
          round,
          block,
          exercise,
          index,
          count: block.exercises.length,
          endsBlock: index === block.exercises.length - 1 && run.walk_seconds === 0,
        });
      });
      if (run.walk_seconds > 0) steps.push({ kind: "walk", round, block, seconds: run.walk_seconds });
    }
  }
  if (circuit.cool_down) steps.push({ kind: "cool_down", seconds: circuit.cool_down.minutes * 60, detail: circuit.cool_down.detail ?? "" });
  return steps;
}

/** True once passing this step means a whole block has been done. */
function endsBlock(step: Step): boolean {
  if (step.kind === "walk") return true;
  if (step.kind === "exercise") return step.endsBlock;
  // A block with no exercises and no walk ends on its run.
  if (step.kind === "run") return step.block.exercises.length === 0 && step.run.walk_seconds === 0;
  return false;
}

function stepSeconds(step: Step): number | null {
  switch (step.kind) {
    case "run":
      return step.run.run_seconds;
    case "exercise":
      return step.exercise.dose_type === "time" ? step.exercise.amount * (step.exercise.per_side ? 2 : 1) : null;
    default:
      return step.seconds;
  }
}

// A countdown that keeps true time even if the phone locks or the tab
// sleeps, because it works from the clock rather than counting ticks. Each
// step mounts its own, so nothing carries over from the step before.
function useCountdown(totalSeconds: number, autoStart: boolean, onFinish: () => void) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [running, setRunning] = useState(autoStart && totalSeconds > 0);
  const [startedAt] = useState(() => (autoStart && totalSeconds > 0 ? Date.now() : null));
  const startedAtRef = useRef<number | null>(startedAt);
  const banked = useRef(0);
  const finished = useRef(false);
  const finishRef = useRef(onFinish);

  useEffect(() => {
    finishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const e = banked.current + (startedAtRef.current ? Date.now() - startedAtRef.current : 0);
      const capped = Math.min(e, totalSeconds * 1000);
      setElapsedMs(capped);
      if (capped >= totalSeconds * 1000 && !finished.current) {
        finished.current = true;
        banked.current = totalSeconds * 1000;
        startedAtRef.current = null;
        setRunning(false);
        try {
          navigator.vibrate?.([200, 100, 200]);
        } catch {
          // Not every phone allows it.
        }
        finishRef.current();
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [running, totalSeconds]);

  const start = useCallback(() => {
    if (finished.current) return;
    startedAtRef.current = Date.now();
    setRunning(true);
  }, []);

  const pause = useCallback(() => {
    if (startedAtRef.current) banked.current += Date.now() - startedAtRef.current;
    startedAtRef.current = null;
    setRunning(false);
  }, []);

  /** Seconds actually spent, so far. */
  const spentSeconds = useCallback(() => {
    const e = banked.current + (startedAtRef.current ? Date.now() - startedAtRef.current : 0);
    return Math.min(totalSeconds, Math.round(e / 1000));
  }, [totalSeconds]);

  return { remaining: Math.max(0, totalSeconds - Math.floor(elapsedMs / 1000)), running, start, pause, spentSeconds, finished: elapsedMs >= totalSeconds * 1000 };
}

function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock
      ?.request("screen")
      .then((l) => {
        lock = l;
      })
      .catch(() => undefined);
    return () => {
      lock?.release().catch(() => undefined);
    };
  }, [active]);
}

function runHow(run: CircuitRun): string {
  const parts: string[] = [];
  if (run.speed_kmh != null) parts.push(`${run.speed_kmh} km/h`);
  if (run.incline_pct != null && run.incline_pct > 0) parts.push(`${run.incline_pct}% incline`);
  if (run.effort != null) parts.push(`effort ${run.effort} out of 10`);
  return parts.join(", ");
}

function ExerciseMedia({ exercise }: { exercise: ClientCircuitExercise }) {
  if (exercise.video) {
    return (
      <div className={styles.videoEmbed} style={{ aspectRatio: exercise.video.aspectRatio }}>
        <iframe src={exercise.video.embedUrl} title={exercise.name} allow="fullscreen; picture-in-picture" allowFullScreen className={styles.videoFrame} />
      </div>
    );
  }
  if (exercise.illustration) {
    return (
      <div className={styles.illustration}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={exercise.illustration} alt={`${exercise.name}, start and finish`} loading="lazy" className={styles.illustrationImg} />
      </div>
    );
  }
  return null;
}

function Overview({ circuit }: { circuit: ClientCircuit }) {
  const changesByRound = circuit.blocks.some((b) => b.by_round?.some((r) => r && Object.keys(r).length > 0));
  return (
    <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>
      {circuit.warm_up && (
        <p style={{ margin: "0 0 8px" }}>
          <strong>Warm up:</strong> {circuit.warm_up.minutes} min{circuit.warm_up.detail ? `, ${circuit.warm_up.detail}` : ""}
        </p>
      )}
      <p style={{ margin: "0 0 6px" }}>
        <strong>
          {circuit.rounds} round{circuit.rounds === 1 ? "" : "s"} of:
        </strong>
      </p>
      <ol style={{ margin: "0 0 8px", paddingLeft: 20 }}>
        {circuit.blocks.map((b, i) => {
          const run = runForRound(b, 1);
          return (
            <li key={i} style={{ marginBottom: 6 }}>
              <strong>{b.block}:</strong> {runText(run).replace(/^Run/, "run")}
              {b.exercises.length > 0 ? `, then ${b.exercises.map((e) => `${e.name} ${doseText(e)}`).join(", ")}` : ""}
              {run.walk_seconds > 0 ? `, then walk ${formatSeconds(run.walk_seconds)}` : ""}
            </li>
          );
        })}
      </ol>
      {changesByRound && <p style={{ margin: "0 0 8px", color: "var(--muted)" }}>Some runs change from one round to the next. The app shows you each one as you get to it.</p>}
      {circuit.cool_down && (
        <p style={{ margin: "0 0 8px" }}>
          <strong>Cool down:</strong> {circuit.cool_down.minutes} min{circuit.cool_down.detail ? `, ${circuit.cool_down.detail}` : ""}
        </p>
      )}
    </div>
  );
}

function LogForm({
  programmeId,
  workoutId,
  weekNumber,
  blocksPlanned,
  blocksCompleted,
  runSeconds,
  onSaved,
}: {
  programmeId: string;
  workoutId: string;
  weekNumber: number;
  blocksPlanned: number;
  blocksCompleted: number;
  runSeconds: number;
  onSaved: (flareUp: boolean) => void;
}) {
  const [blocks, setBlocks] = useState(blocksCompleted);
  const [runMin, setRunMin] = useState(Math.floor(runSeconds / 60));
  const [runSec, setRunSec] = useState(runSeconds % 60);
  const [symptomScore, setSymptomScore] = useState(0);
  const [flareUp, setFlareUp] = useState<boolean | null>(null);
  const [noticed, setNoticed] = useState("");
  const [notSure, setNotSure] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (flareUp === null) return;
    setSaving(true);
    setError(null);
    const completed = Math.max(0, Math.min(blocksPlanned, Math.round(blocks)));
    try {
      const res = await fetch("/api/session/card-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programme_id: programmeId,
          workout_id: workoutId,
          week_number: weekNumber,
          quality: completed >= blocksPlanned ? "finished" : completed > 0 ? "partial" : "not_done",
          pain: symptomScore,
          note: noticed,
          run_circuit: {
            blocks_planned: blocksPlanned,
            blocks_completed: completed,
            run_seconds: Math.max(0, Math.round(runMin) * 60 + Math.round(runSec)),
            flare_up: flareUp,
            symptoms: noticed,
            not_sure: notSure,
          },
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "That didn't save.");
      onSaved(flareUp);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't save.");
    } finally {
      setSaving(false);
    }
  }

  const label = { fontSize: 13.5, fontWeight: 500, marginBottom: 8 } as const;
  const numberInput = { width: 64, borderRadius: 8, border: "1px solid var(--stone)", padding: "6px 8px", fontSize: 15 } as const;

  return (
    <div style={{ marginTop: 12, padding: "14px 14px 16px", background: "var(--mist)", borderRadius: 10 }}>
      <div style={label}>Blocks completed</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, fontSize: 14 }}>
        <input type="number" min={0} max={blocksPlanned} value={blocks} onChange={(e) => setBlocks(Number(e.target.value) || 0)} style={numberInput} />
        <span>of {blocksPlanned}</span>
      </div>

      <div style={label}>Total run time</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, fontSize: 14 }}>
        <input type="number" min={0} value={runMin} onChange={(e) => setRunMin(Math.max(0, Number(e.target.value) || 0))} style={numberInput} aria-label="Minutes" />
        <span>min</span>
        <input type="number" min={0} max={59} value={runSec} onChange={(e) => setRunSec(Math.max(0, Math.min(59, Number(e.target.value) || 0)))} style={numberInput} aria-label="Seconds" />
        <span>sec</span>
      </div>

      <div style={label}>Any symptoms during, from 0 for none to 10</div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <input type="range" min={0} max={10} step={1} value={symptomScore} onChange={(e) => setSymptomScore(Number(e.target.value))} style={{ flex: 1 }} />
        <span style={{ fontSize: 15, fontWeight: 600, minWidth: 20, textAlign: "center" }}>{symptomScore}</span>
      </div>

      <div style={label}>Did anything flare up?</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[
          { v: false, l: "No" },
          { v: true, l: "Yes" },
        ].map((o) => (
          <button key={o.l} type="button" className={`${styles.sidePill} ${flareUp === o.v ? styles.sidePillActive : ""}`} onClick={() => setFlareUp(o.v)}>
            {o.l}
          </button>
        ))}
      </div>

      <div style={label}>What did you notice? (optional)</div>
      <textarea
        value={noticed}
        onChange={(e) => setNoticed(e.target.value)}
        placeholder="Where you felt it, when it came on, and how it settled"
        style={{ width: "100%", minHeight: 60, borderRadius: 8, border: "1px solid var(--stone)", padding: 8, fontSize: 13.5, marginBottom: 10, boxSizing: "border-box" }}
      />

      <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13.5, marginBottom: notSure ? 6 : 14 }}>
        <input type="checkbox" checked={notSure} onChange={(e) => setNotSure(e.target.checked)} style={{ marginTop: 3 }} />
        I wasn&apos;t sure I was getting some of it right
      </label>
      {notSure && (
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 14px", lineHeight: 1.5 }}>
          That is a good sign. It means you were feeling the movement rather than just completing it. Tell Dr David Silver PhD what felt uncertain and it
          becomes useful information.
        </p>
      )}

      {error && <div style={{ fontSize: 13, color: "var(--crimson-dark)", marginBottom: 8 }}>{error}</div>}
      <button type="button" className={styles.doneButton} disabled={flareUp === null || saving} onClick={save}>
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

function StepView({
  step,
  stepNumber,
  stepCount,
  rounds,
  autoStart,
  isLast,
  onNext,
  onBack,
  onStop,
}: {
  step: Step;
  stepNumber: number;
  stepCount: number;
  rounds: number;
  autoStart: boolean;
  isLast: boolean;
  /** spent: seconds the timer actually ran, for a run. */
  onNext: (spent: number, fromTimer: boolean) => void;
  onBack: (spent: number) => void;
  onStop: (spent: number) => void;
}) {
  const seconds = stepSeconds(step);
  const timed = seconds != null;
  // A timer that runs out on its own carries straight on to the next step.
  const finishRef = useRef<() => void>(() => undefined);
  const countdown = useCountdown(seconds ?? 0, autoStart && timed && step.kind !== "exercise", () => finishRef.current());
  useEffect(() => {
    finishRef.current = () => onNext(countdown.spentSeconds(), true);
  }, [onNext, countdown]);

  let eyebrow = "";
  let heading = "";
  let detail = "";
  switch (step.kind) {
    case "warm_up":
    case "cool_down":
      eyebrow = step.kind === "warm_up" ? "Warm up" : "Cool down";
      heading = `${eyebrow}, ${formatSeconds(step.seconds)}`;
      detail = step.detail;
      break;
    case "run":
      eyebrow = `Round ${step.round} of ${rounds}, ${step.block.block}`;
      heading = `Run ${formatSeconds(step.run.run_seconds)}`;
      detail = [runHow(step.run), step.run.note].filter(Boolean).join(". ");
      break;
    case "walk":
      eyebrow = `Round ${step.round} of ${rounds}, ${step.block.block}`;
      heading = `Walk ${formatSeconds(step.seconds)}`;
      detail = "Easy walking while your breathing settles, before the next block.";
      break;
    case "exercise":
      eyebrow = `Round ${step.round} of ${rounds}, ${step.block.block}, exercise ${step.index + 1} of ${step.count}`;
      heading = step.exercise.name;
      detail = doseText(step.exercise);
      break;
  }
  const exercise = step.kind === "exercise" ? step.exercise : null;
  const spent = () => (step.kind === "run" ? countdown.spentSeconds() : 0);

  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
        Step {stepNumber} of {stepCount}
      </div>
      <div style={{ height: 4, background: "var(--mist)", borderRadius: 2, marginBottom: 12 }}>
        <div style={{ height: 4, width: `${(stepNumber / stepCount) * 100}%`, background: "var(--crimson, #9B1C1C)", borderRadius: 2 }} />
      </div>

      {exercise && <ExerciseMedia exercise={exercise} />}

      <div className={styles.eyebrow} style={{ marginTop: 10 }}>
        {eyebrow}
      </div>
      <div className={styles.xname} style={{ marginTop: 4 }}>
        {heading}
      </div>
      {detail && <p className={styles.cardioPlain}>{detail}</p>}
      {exercise?.note && <p className={styles.cardioPlain}>{exercise.note}</p>}
      {exercise?.why && <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>Why this is here: {exercise.why}</p>}

      {timed && (
        <div style={{ textAlign: "center", margin: "16px 0 12px" }}>
          <div style={{ fontSize: 44, fontWeight: 600, fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em" }}>{clockText(countdown.remaining)}</div>
          {!countdown.finished && (
            <button type="button" className={styles.sidePill} style={{ marginTop: 8 }} onClick={countdown.running ? countdown.pause : countdown.start}>
              {countdown.running ? "Pause" : countdown.remaining < (seconds ?? 0) ? "Carry on" : "Start the timer"}
            </button>
          )}
        </div>
      )}

      <button type="button" className={styles.doneButton} onClick={() => onNext(spent(), false)}>
        {isLast ? "Finish" : step.kind === "exercise" ? "Done, next" : timed && !countdown.finished ? "Skip to the next step" : "Next"}
      </button>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginTop: 10 }}>
        <button
          type="button"
          onClick={() => onBack(spent())}
          disabled={stepNumber === 1}
          style={{ border: "none", background: "none", color: "var(--muted)", fontSize: 13, padding: 0 }}
        >
          &larr; Back a step
        </button>
        <button type="button" onClick={() => onStop(spent())} style={{ border: "none", background: "none", color: "var(--muted)", fontSize: 13, padding: 0 }}>
          Stop here and log what I did
        </button>
      </div>
    </div>
  );
}

function Player({
  steps,
  circuitRounds,
  onStop,
}: {
  steps: Step[];
  circuitRounds: number;
  onStop: (blocksCompleted: number, runSeconds: number) => void;
}) {
  const [index, setIndex] = useState(0);
  const [autoStart, setAutoStart] = useState(false);
  const runSpent = useRef<Map<number, number>>(new Map());
  const blocksDone = useRef<Set<number>>(new Set());
  useWakeLock(true);

  const record = useCallback(
    (spent: number) => {
      if (steps[index].kind === "run") runSpent.current.set(index, spent);
    },
    [steps, index]
  );

  const finish = useCallback(() => {
    const run = Array.from(runSpent.current.values()).reduce((a, b) => a + b, 0);
    onStop(blocksDone.current.size, run);
  }, [onStop]);

  const next = useCallback(
    (spent: number, fromTimer: boolean) => {
      record(spent);
      if (endsBlock(steps[index])) blocksDone.current.add(index);
      if (index >= steps.length - 1) {
        finish();
        return;
      }
      setAutoStart(fromTimer);
      setIndex(index + 1);
    },
    [record, steps, index, finish]
  );

  return (
    <StepView
      key={index}
      step={steps[index]}
      stepNumber={index + 1}
      stepCount={steps.length}
      rounds={circuitRounds}
      autoStart={autoStart}
      isLast={index === steps.length - 1}
      onNext={next}
      onBack={(spent) => {
        if (index === 0) return;
        record(spent);
        blocksDone.current.delete(index - 1);
        setAutoStart(false);
        setIndex(index - 1);
      }}
      onStop={(spent) => {
        record(spent);
        finish();
      }}
    />
  );
}

// One Run Circuit, as the client sees it: an overview, then a walk through
// round by round (the run, each exercise with its video, the walk, then the
// next block), then a short log of what was done.
export default function RunCircuitSession({ programmeId, workoutId, weekNumber, dayNumber, title, summary, notes, circuit, done: initiallyDone, flareRuleText }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [stage, setStage] = useState<"overview" | "playing" | "logging" | "saved">(initiallyDone ? "saved" : "overview");
  const [result, setResult] = useState({ blocks: 0, run: 0 });
  const [flared, setFlared] = useState(false);

  const steps = useMemo(() => buildSteps(circuit), [circuit]);
  const blocksPlanned = circuit.rounds * circuit.blocks.length;
  const minutes = estimateMinutes(circuit);

  if (!expanded) {
    return (
      <button type="button" className={styles.row} onClick={() => setExpanded(true)}>
        <div className={styles.thumb}>
          <div className={styles.mini} />
        </div>
        <div className={styles.rmeta}>
          <div className={styles.rn}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: "#9B1C1C", marginRight: 6 }} />
            {title}
            {stage === "saved" ? " (done)" : ""}
          </div>
          <div className={styles.rd}>
            {summary || `Run Circuit, ${circuit.rounds} round${circuit.rounds === 1 ? "" : "s"} of ${circuit.blocks.length} blocks, about ${minutes} min`}
          </div>
        </div>
        <div className={styles.chevr}>&rsaquo;</div>
      </button>
    );
  }

  return (
    <div className={styles.card} style={{ width: "100%", boxSizing: "border-box" }}>
      <div style={{ padding: "14px 16px 16px" }}>
        {stage !== "playing" && (
          <>
            <div className={styles.xname}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: "#9B1C1C", marginRight: 6 }} />
              {title}
            </div>
            {summary && <p className={styles.cardioPlain}>{summary}</p>}
            <p className={styles.cardioPlain}>
              About {minutes} min, with {formatSeconds(plannedRunSeconds(circuit))} of running in all.
            </p>
          </>
        )}

        {stage === "overview" && (
          <>
            <Overview circuit={circuit} />
            {notes && (
              <details className={styles.details}>
                <summary className={styles.summary}>
                  Notes <span className={styles.chev}>&#8964;</span>
                </summary>
                <div className={styles.why}>{notes}</div>
              </details>
            )}
            <button type="button" className={styles.doneButton} onClick={() => setStage("playing")}>
              Start the circuit
            </button>
            <button
              type="button"
              onClick={() => {
                setResult({ blocks: blocksPlanned, run: plannedRunSeconds(circuit) });
                setStage("logging");
              }}
              style={{ border: "none", background: "none", color: "var(--muted)", fontSize: 13, padding: 0, marginTop: 10 }}
            >
              Already done it? Log it without the walkthrough
            </button>
          </>
        )}

        {stage === "playing" && (
          <Player
            steps={steps}
            circuitRounds={circuit.rounds}
            onStop={(blocks, run) => {
              setResult({ blocks, run });
              setStage("logging");
            }}
          />
        )}

        {stage === "logging" && (
          <>
            <p style={{ fontSize: 13.5, lineHeight: 1.5, margin: "4px 0 0" }}>
              {result.blocks >= blocksPlanned
                ? "That is the whole circuit. A short note on how it went helps shape the next one."
                : "However far you got, that is information. Record it as it was and it shapes the next one."}
            </p>
            <LogForm
              programmeId={programmeId}
              workoutId={workoutId}
              weekNumber={weekNumber}
              blocksPlanned={blocksPlanned}
              blocksCompleted={result.blocks}
              runSeconds={result.run}
              onSaved={(flareUp) => {
                setFlared(flareUp);
                setStage("saved");
              }}
            />
          </>
        )}

        {stage === "saved" && (
          <>
            <button type="button" className={`${styles.doneButton} ${styles.isDone}`} disabled>
              Done ✓
            </button>
            <VoiceNoteButton programmeId={programmeId} workoutId={workoutId} weekNumber={weekNumber} dayOfWeek={dayNumber} contextTitle={title} />
            {flared && flareRuleText && <FlareBox programmeId={programmeId} weekNumber={weekNumber} flareRuleText={flareRuleText} />}
            {!flared && (
              <button
                type="button"
                onClick={() => setStage("overview")}
                style={{ border: "none", background: "none", color: "var(--muted)", fontSize: 13, padding: 0, marginTop: 10, display: "block" }}
              >
                See the circuit again
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
