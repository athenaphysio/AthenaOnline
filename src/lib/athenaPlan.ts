// The athena-plan-v1 format: a whole cardio programme (running, cycling,
// swimming) plus its weekly calendar, designed and reviewed in Claude
// chat, pasted into the app as one block of JSON. The app never writes or
// changes this content -- it only validates the shape, stores it exactly
// as given, and renders it. See the Step 2 brief.

export const SESSION_TYPES = ["run", "bike", "swim", "strength", "rest", "other"] as const;
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
};

export type PlanWeek = {
  week: number;
  label: string;
  focus: string;
  sessions: PlanSession[];
};

export type AthenaPlanV1 = {
  format: "athena-plan-v1";
  client_name: string;
  block_title: string;
  start_date: string;
  intro: string;
  weeks: PlanWeek[];
  rules: { move_on: string; flare: string };
};

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
export function validateAthenaPlan(raw: unknown, options: { allowAnyDay?: boolean } = {}): PlanValidation {
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

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, plan: raw as unknown as AthenaPlanV1 };
}
