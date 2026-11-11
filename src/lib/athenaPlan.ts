// The athena-plan-v1 format: a whole cardio programme (running, cycling,
// swimming) plus its weekly calendar, designed and reviewed in Claude
// chat, pasted into the app as one block of JSON. The app never writes or
// changes this content -- it only validates the shape, stores it exactly
// as given, and renders it. See the Step 2 brief.

import type { PlanCircuit } from "@/lib/runCircuit";

export const SESSION_TYPES = ["run", "bike", "swim", "row", "strength", "rest", "other", "run_circuit"] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

export const SESSION_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun", "any"] as const;
export type SessionDay = (typeof SESSION_DAYS)[number];

export type PlanStep = { label: string; detail: string };

export type PlanSession = {
  id: string;
  day: SessionDay;
  order: number;
  type: SessionType;
  title: string;
  summary: string;
  steps: PlanStep[];
  target: string;
  total: string;
  notes: string;
  /** Only on a "run_circuit" session: which of David's circuit blocks, in
   * what order, how many rounds, and the run and walk for each block. */
  circuit?: PlanCircuit;
};

export type PlanWeek = {
  week: number;
  label: string;
  focus: string;
  sessions: PlanSession[];
};

/**
 * Optional. What the consultation said about strength, so the app's strength
 * engine can build a framework strength programme for David to review. Every
 * field is optional: leave out anything the consultation did not cover,
 * never guess. See strengthFromPlan below for how it is read.
 */
export type PlanStrength = {
  /** false: David will do strength himself, so nothing is built. Defaults to true. */
  build?: boolean;
  sessions_per_week?: number;
  /** Fixed days, or "any" for the client to choose each week. */
  days?: ("mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun")[] | "any";
  minutes?: number;
  split?: "full" | "upper_lower";
  kit?: string[];
  experience?: "new" | "some" | "experienced";
  current_lifts?: string;
  goal?: string;
  avoid?: string;
  focus?: string[];
  notes?: string;
};

export type AthenaPlanV1 = {
  format: "athena-plan-v1";
  client_name: string;
  block_title: string;
  start_date: string;
  intro: string;
  weeks: PlanWeek[];
  rules: { move_on: string; flare: string };
  strength?: PlanStrength;
};

export const STRENGTH_KIT = ["gym", "barbell", "dumbbell", "kettlebell", "cable", "machine", "bench", "pullup", "band", "step", "none"] as const;
export const STRENGTH_FOCUS = ["knee", "back", "shoulder", "ankle", "hip", "neck", "concussion"] as const;
const STRENGTH_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export type PlanValidation = { valid: true; plan: AthenaPlanV1 } | { valid: false; errors: string[] };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isDateString(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(v).getTime());
}

// Structural validation only -- presence, type, and the fixed enums
// (type/day). Never checks whether the content itself is sensible; that's
// David's and Claude chat's job, not this app's. Collects every problem
// found rather than stopping at the first, so one paste attempt surfaces
// the whole list.
export type PlanValidationOptions = {
  allowAnyDay?: boolean;
  /** The names in David's Run Circuit library. When given, every block and
   * set a run_circuit session names must be one of these. */
  circuitLibrary?: { blocks: string[]; sets: string[] };
};

const CIRCUIT_RUN_KEYS = ["run_seconds", "effort", "speed_kmh", "incline_pct", "walk_seconds", "note"] as const;
const CIRCUIT_BLOCK_KEYS = new Set<string>(["block", "by_round", ...CIRCUIT_RUN_KEYS]);
const CIRCUIT_KEYS = new Set<string>(["set", "rounds", "warm_up", "cool_down", "blocks"]);
const EXERCISE_WORDS = /^(exercises?|items?|reps|contacts|sets|dose|dosage|exercise_id)$/i;

function isNumberIn(v: unknown, min: number, max: number): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
}

// The run part of a circuit block, or one round's change to it. In a round
// change every field is optional.
function checkCircuitRun(r: Record<string, unknown>, label: string, errors: string[], partial: boolean) {
  if (r.run_seconds !== undefined || !partial) {
    if (!isNumberIn(r.run_seconds, 5, 3600) || !Number.isInteger(r.run_seconds)) errors.push(`${label}: "run_seconds" must be a whole number of seconds from 5 to 3600.`);
  }
  if (r.walk_seconds !== undefined || !partial) {
    if (!isNumberIn(r.walk_seconds, 0, 1800) || !Number.isInteger(r.walk_seconds)) errors.push(`${label}: "walk_seconds" must be a whole number of seconds from 0 to 1800 (0 for no walk).`);
  }
  if (r.effort !== undefined && !isNumberIn(r.effort, 1, 10)) errors.push(`${label}: "effort" must be a number from 1 to 10.`);
  if (r.speed_kmh !== undefined && !isNumberIn(r.speed_kmh, 1, 25)) errors.push(`${label}: "speed_kmh" must be a number from 1 to 25.`);
  if (r.incline_pct !== undefined && !isNumberIn(r.incline_pct, 0, 20)) errors.push(`${label}: "incline_pct" must be a number from 0 to 20.`);
  if (r.note !== undefined && typeof r.note !== "string") errors.push(`${label}: "note" must be text.`);
  if (!partial && r.effort === undefined && r.speed_kmh === undefined) errors.push(`${label}: give the run an "effort" out of 10, a treadmill "speed_kmh", or both.`);
}

function checkCircuit(c: unknown, label: string, errors: string[], library?: { blocks: string[]; sets: string[] }) {
  if (!isPlainObject(c)) {
    errors.push(`${label}: a run_circuit session needs a "circuit" object (rounds and blocks).`);
    return;
  }
  for (const k of Object.keys(c)) {
    if (!CIRCUIT_KEYS.has(k)) errors.push(`${label}: "circuit.${k}" isn't a circuit field (use set, rounds, warm_up, cool_down and blocks).`);
  }
  if (!isNumberIn(c.rounds, 1, 10) || !Number.isInteger(c.rounds)) errors.push(`${label}: "circuit.rounds" must be a whole number from 1 to 10.`);
  const rounds = typeof c.rounds === "number" ? c.rounds : 0;

  const blockNames = library ? new Set(library.blocks.map((n) => n.trim().toLowerCase())) : null;
  const setNames = library ? new Set(library.sets.map((n) => n.trim().toLowerCase())) : null;

  if (c.set !== undefined) {
    if (!isNonEmptyString(c.set)) errors.push(`${label}: "circuit.set" must be the name of one of your phase sets, or left out.`);
    else if (setNames && !setNames.has(c.set.trim().toLowerCase())) errors.push(`${label}: there is no phase set called "${c.set}" in the Run Circuit library.`);
  }
  for (const k of ["warm_up", "cool_down"] as const) {
    const w = c[k];
    if (w === undefined) continue;
    if (!isPlainObject(w) || !isNumberIn(w.minutes, 1, 60)) errors.push(`${label}: "circuit.${k}" needs "minutes" from 1 to 60, and can have a "detail".`);
    else if (w.detail !== undefined && typeof w.detail !== "string") errors.push(`${label}: "circuit.${k}.detail" must be text.`);
  }

  if (!Array.isArray(c.blocks) || c.blocks.length === 0 || c.blocks.length > 12) {
    errors.push(`${label}: "circuit.blocks" must be a list of 1 to 12 blocks.`);
    return;
  }
  c.blocks.forEach((b, i) => {
    const bLabel = `${label}, circuit block ${i + 1}`;
    if (!isPlainObject(b)) {
      errors.push(`${bLabel}: expected an object.`);
      return;
    }
    for (const k of Object.keys(b)) {
      if (EXERCISE_WORDS.test(k)) {
        errors.push(`${bLabel}: plan code can't add or change the exercises in a circuit block. Those come from Dr David Silver PhD's library, so remove "${k}".`);
      } else if (!CIRCUIT_BLOCK_KEYS.has(k)) {
        errors.push(`${bLabel}: "${k}" isn't a circuit block field (use block, run_seconds, effort, speed_kmh, incline_pct, walk_seconds, note and by_round).`);
      }
    }
    if (!isNonEmptyString(b.block)) {
      errors.push(`${bLabel}: "block" must be the name of one of your circuit blocks.`);
    } else if (blockNames && !blockNames.has(b.block.trim().toLowerCase())) {
      errors.push(`${bLabel}: there is no circuit block called "${b.block}" in the Run Circuit library. Use builder.circuit_library() for the exact names.`);
    }
    checkCircuitRun(b, bLabel, errors, false);
    if (b.by_round !== undefined) {
      if (!Array.isArray(b.by_round) || (rounds > 0 && b.by_round.length > rounds)) {
        errors.push(`${bLabel}: "by_round" must be a list with no more entries than there are rounds.`);
      } else {
        b.by_round.forEach((r, ri) => {
          const rLabel = `${bLabel}, round ${ri + 1}`;
          if (r === null) return;
          if (!isPlainObject(r)) {
            errors.push(`${rLabel}: expected an object (use {} to keep the block's own run for that round).`);
            return;
          }
          for (const k of Object.keys(r)) {
            if (EXERCISE_WORDS.test(k)) errors.push(`${rLabel}: plan code can't change the exercises in a circuit block, so remove "${k}".`);
            else if (!(CIRCUIT_RUN_KEYS as readonly string[]).includes(k)) errors.push(`${rLabel}: "${k}" isn't a run field (use run_seconds, effort, speed_kmh, incline_pct, walk_seconds and note).`);
          }
          checkCircuitRun(r, rLabel, errors, true);
        });
      }
    }
  });
}

export function validateAthenaPlan(raw: unknown, options: PlanValidationOptions = {}): PlanValidation {
  const errors: string[] = [];

  if (!isPlainObject(raw)) {
    return { valid: false, errors: ["That doesn't look like a plan at all -- expected a JSON object."] };
  }

  if (raw.format !== "athena-plan-v1") {
    errors.push(`The "format" field must be "athena-plan-v1" (found ${JSON.stringify(raw.format ?? null)}).`);
  }
  if (!isNonEmptyString(raw.client_name)) errors.push('Missing or empty "client_name".');
  if (!isNonEmptyString(raw.block_title)) errors.push('Missing or empty "block_title".');
  if (!isDateString(raw.start_date)) errors.push('Missing "start_date", or it isn\'t a valid date in the form YYYY-MM-DD.');
  if (typeof raw.intro !== "string") errors.push('"intro" must be text (it can be empty, but the field must be there).');

  if (!isPlainObject(raw.rules)) {
    errors.push('Missing "rules" (needs "move_on" and "flare").');
  } else {
    if (!isNonEmptyString(raw.rules.move_on)) errors.push('Missing or empty "rules.move_on".');
    if (!isNonEmptyString(raw.rules.flare)) errors.push('Missing or empty "rules.flare".');
  }

  const seenSessionIds = new Set<string>();

  if (!Array.isArray(raw.weeks) || raw.weeks.length === 0) {
    errors.push('"weeks" must be a list with at least one week.');
  } else {
    raw.weeks.forEach((week, wIdx) => {
      const wLabel = `Week ${wIdx + 1}`;
      if (!isPlainObject(week)) {
        errors.push(`${wLabel}: expected an object.`);
        return;
      }
      if (typeof week.week !== "number" || !Number.isFinite(week.week)) {
        errors.push(`${wLabel}: "week" is missing or isn't a number.`);
      }
      if (typeof week.label !== "string") errors.push(`${wLabel}: "label" must be text (it can be empty).`);
      if (typeof week.focus !== "string") errors.push(`${wLabel}: "focus" must be text (it can be empty).`);

      if (!Array.isArray(week.sessions)) {
        errors.push(`${wLabel}: "sessions" must be a list.`);
        return;
      }
      week.sessions.forEach((session, sIdx) => {
        const sLabel = `${wLabel}, session ${sIdx + 1}`;
        if (!isPlainObject(session)) {
          errors.push(`${sLabel}: expected an object.`);
          return;
        }
        if (!isNonEmptyString(session.id)) {
          errors.push(`${sLabel}: missing "id".`);
        } else {
          if (seenSessionIds.has(session.id)) errors.push(`Session id "${session.id}" is used more than once.`);
          seenSessionIds.add(session.id);
        }
        if (session.day === "any" && !options.allowAnyDay) {
          errors.push(`${sLabel}: give this session a specific day, from mon to sun, rather than "any".`);
        } else if (!SESSION_DAYS.includes(session.day as SessionDay)) {
          errors.push(`${sLabel}: "day" must be one of ${SESSION_DAYS.filter((d) => options.allowAnyDay || d !== "any").join(", ")} (found ${JSON.stringify(session.day ?? null)}).`);
        }
        if (typeof session.order !== "number" || !Number.isFinite(session.order)) {
          errors.push(`${sLabel}: "order" is missing or isn't a number.`);
        }
        if (!SESSION_TYPES.includes(session.type as SessionType)) {
          errors.push(`${sLabel}: "type" must be one of ${SESSION_TYPES.join(", ")} (found ${JSON.stringify(session.type ?? null)}).`);
        }
        if (!isNonEmptyString(session.title)) errors.push(`${sLabel} is missing a title.`);
        for (const field of ["summary", "target", "total", "notes"] as const) {
          if (typeof session[field] !== "string") errors.push(`${sLabel}: "${field}" must be text (it can be empty).`);
        }
        if (session.type === "run_circuit") {
          checkCircuit(session.circuit, sLabel, errors, options.circuitLibrary);
        } else if (session.circuit !== undefined) {
          errors.push(`${sLabel}: only a session of type "run_circuit" can have a "circuit".`);
        }
        if (!Array.isArray(session.steps)) {
          errors.push(`${sLabel}: "steps" must be a list (it can be empty).`);
        } else {
          session.steps.forEach((step, stIdx) => {
            const stLabel = `${sLabel}, step ${stIdx + 1}`;
            if (!isPlainObject(step)) {
              errors.push(`${stLabel}: expected an object.`);
              return;
            }
            if (typeof step.label !== "string") errors.push(`${stLabel}: "label" must be text.`);
            if (typeof step.detail !== "string") errors.push(`${stLabel}: "detail" must be text.`);
          });
        }
      });
    });
  }

  if (raw.strength !== undefined) {
    const st = raw.strength;
    if (!isPlainObject(st)) {
      errors.push('"strength" must be an object (or left out).');
    } else {
      if (st.build !== undefined && typeof st.build !== "boolean") errors.push('"strength.build" must be true or false.');
      for (const k of ["sessions_per_week", "minutes"] as const) {
        if (st[k] !== undefined && (typeof st[k] !== "number" || !Number.isFinite(st[k]) || (st[k] as number) < 0)) errors.push(`"strength.${k}" must be a number.`);
      }
      if (st.days !== undefined && st.days !== "any" && !(Array.isArray(st.days) && st.days.every((d) => STRENGTH_DAYS.includes(d as (typeof STRENGTH_DAYS)[number])))) {
        errors.push('"strength.days" must be "any" or a list of days from mon to sun.');
      }
      if (st.split !== undefined && st.split !== "full" && st.split !== "upper_lower") errors.push('"strength.split" must be "full" or "upper_lower".');
      if (st.experience !== undefined && !["new", "some", "experienced"].includes(st.experience as string)) errors.push('"strength.experience" must be "new", "some" or "experienced".');
      if (st.kit !== undefined && !(Array.isArray(st.kit) && st.kit.every((k) => STRENGTH_KIT.includes(k as (typeof STRENGTH_KIT)[number])))) {
        errors.push(`"strength.kit" must be a list from: ${STRENGTH_KIT.join(", ")}.`);
      }
      if (st.focus !== undefined && !(Array.isArray(st.focus) && st.focus.every((f) => STRENGTH_FOCUS.includes(f as (typeof STRENGTH_FOCUS)[number])))) {
        errors.push(`"strength.focus" must be a list from: ${STRENGTH_FOCUS.join(", ")}.`);
      }
      for (const k of ["current_lifts", "goal", "avoid", "notes"] as const) {
        if (st[k] !== undefined && typeof st[k] !== "string") errors.push(`"strength.${k}" must be text.`);
      }
    }
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, plan: raw as unknown as AthenaPlanV1 };
}
