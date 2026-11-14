// The athena-pathway-v1 format: one of Dr David Silver PhD's clinical
// pathways, written as a flowchart. It is drafted in the Clinical Pathways
// Claude Project, pasted in here as one block of JSON, and stored whole in
// pathways.definition, so it can be copied back out without loss.
//
// A pathway has an entry (which presentation starts at which stage), a
// list of stages, each with core and optional drills, decision points that
// branch between stages, a progression rule, a flare-up plan and the
// functional goals it works towards. Pure and client-safe: no database.

export type PathwayDrillRole = "core" | "optional";

export type PathwayDrill = {
  name: string;
  exercise_ids: string[];
  role: PathwayDrillRole;
  notes: string;
};

export type PathwayProgressRule = {
  load: string;
  completion: string;
  symptoms: string;
};

export type PathwayStage = {
  id: string;
  title: string;
  rationale: string;
  drills: PathwayDrill[];
  /** null: the pathway's own progress rule applies. */
  progress_rule: PathwayProgressRule | null;
  /** The id of the next stage or decision, or null at the end. */
  next: string | null;
};

export type PathwayDecision = {
  id: string;
  question: string;
  options: { answer: string; go_to: string }[];
};

export type PathwayEntry = { presentation: string; start_at: string };

export type PathwayFlareUp = { trigger: string; action: string; return: string };

export type AthenaPathwayV1 = {
  format: "athena-pathway-v1";
  name: string;
  region: string;
  pathology: string;
  premise: string;
  who: string;
  entry: PathwayEntry[];
  excludes: string[];
  progress_rule: PathwayProgressRule;
  flare_up: PathwayFlareUp | null;
  goals: string[];
  stages: PathwayStage[];
  decisions: PathwayDecision[];
};

export const STANDARD_PROGRESS_RULE: PathwayProgressRule = {
  load: "Drill with added load for 2 sets of 6 to 8 reps",
  completion: "Full list of progressions completed",
  symptoms: "No symptoms above 3 out of 10 in the 48 hours after",
};

export type PathwayValidation = { valid: true; pathway: AthenaPathwayV1 } | { valid: false; errors: string[] };

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function strList(v: unknown): string[] {
  if (typeof v === "string") return v.trim() ? [v.trim()] : [];
  if (!Array.isArray(v)) return [];
  return v.map(str).filter(Boolean);
}

function readRule(v: unknown): PathwayProgressRule | null {
  if (!isObj(v)) return null;
  const rule = { load: str(v.load), completion: str(v.completion), symptoms: str(v.symptoms) };
  return rule.load || rule.completion || rule.symptoms ? rule : null;
}

const EXERCISE_ID = /^EX-\d{3,}$/;

// Checks the shape and fills in sensible empties, so a pathway written by
// hand or by Claude opens even when an optional part is missing. Collects
// every problem found rather than stopping at the first. It never judges
// whether the clinical content is right: that is David's job.
export function validatePathway(raw: unknown): PathwayValidation {
  const errors: string[] = [];
  let input = raw;
  if (typeof input === "string") {
    try {
      input = JSON.parse(input);
    } catch {
      return { valid: false, errors: ["That is not valid pathway code. Copy the whole code block, from the first { to the last }."] };
    }
  }
  if (!isObj(input)) return { valid: false, errors: ["The pathway code must be a single object, starting with {."] };
  if (input.format !== "athena-pathway-v1") errors.push('The code must say "format": "athena-pathway-v1".');

  const name = str(input.name);
  if (!name) errors.push('Give the pathway a "name".');

  const stages: PathwayStage[] = [];
  const stageIds = new Set<string>();
  if (!Array.isArray(input.stages) || input.stages.length === 0) {
    errors.push('A pathway needs at least one stage in "stages".');
  } else {
    input.stages.forEach((s, i) => {
      const label = `Stage ${i + 1}`;
      if (!isObj(s)) {
        errors.push(`${label}: expected an object.`);
        return;
      }
      const id = str(s.id) || `S${i + 1}`;
      if (stageIds.has(id)) errors.push(`${label}: the id "${id}" is used twice.`);
      stageIds.add(id);
      const title = str(s.title);
      if (!title) errors.push(`${label}: give it a "title".`);
      const drills: PathwayDrill[] = [];
      if (s.drills !== undefined && !Array.isArray(s.drills)) errors.push(`${label}: "drills" must be a list.`);
      (Array.isArray(s.drills) ? s.drills : []).forEach((d, di) => {
        const dLabel = `${label}, drill ${di + 1}`;
        if (!isObj(d)) {
          errors.push(`${dLabel}: expected an object.`);
          return;
        }
        const dName = str(d.name);
        if (!dName) errors.push(`${dLabel}: give it a "name".`);
        const ids = strList(d.exercise_ids).map((x) => x.toUpperCase());
        for (const x of ids) if (!EXERCISE_ID.test(x)) errors.push(`${dLabel}: "${x}" is not an exercise id like EX-094.`);
        const role = d.role === "optional" ? "optional" : "core";
        if (d.role !== undefined && d.role !== "core" && d.role !== "optional") errors.push(`${dLabel}: "role" must be "core" or "optional".`);
        drills.push({ name: dName, exercise_ids: ids, role, notes: str(d.notes) });
      });
      stages.push({
        id,
        title,
        rationale: str(s.rationale),
        drills,
        progress_rule: readRule(s.progress_rule),
        next: str(s.next) || null,
      });
    });
  }

  const decisions: PathwayDecision[] = [];
  const decisionIds = new Set<string>();
  if (input.decisions !== undefined && !Array.isArray(input.decisions)) errors.push('"decisions" must be a list.');
  (Array.isArray(input.decisions) ? input.decisions : []).forEach((d, i) => {
    const label = `Decision ${i + 1}`;
    if (!isObj(d)) {
      errors.push(`${label}: expected an object.`);
      return;
    }
    const id = str(d.id) || `D${i + 1}`;
    if (stageIds.has(id) || decisionIds.has(id)) errors.push(`${label}: the id "${id}" is already used.`);
    decisionIds.add(id);
    const question = str(d.question);
    if (!question) errors.push(`${label}: give it a "question".`);
    const options = (Array.isArray(d.options) ? d.options : [])
      .filter(isObj)
      .map((o) => ({ answer: str(o.answer), go_to: str(o.go_to) }))
      .filter((o) => o.answer);
    if (options.length < 2) errors.push(`${label}: a decision needs at least two "options".`);
    decisions.push({ id, question, options });
  });

  const known = new Set([...stageIds, ...decisionIds]);
  for (const s of stages) {
    if (s.next && !known.has(s.next)) errors.push(`Stage "${s.title || s.id}": "next" points to "${s.next}", which is not a stage or decision.`);
  }
  for (const d of decisions) {
    for (const o of d.options) {
      if (o.go_to && !known.has(o.go_to)) errors.push(`Decision "${d.question || d.id}": "${o.answer}" goes to "${o.go_to}", which is not a stage or decision.`);
    }
  }

  // Entry: a list of presentations and where each starts. The older single
  // object form, from the first draft of the format, is still read.
  const entry: PathwayEntry[] = [];
  const excludes: string[] = strList(input.excludes);
  if (Array.isArray(input.entry)) {
    input.entry.filter(isObj).forEach((e) => {
      const presentation = str(e.presentation);
      const start = str(e.start_at);
      if (!presentation) return;
      if (start && !stageIds.has(start)) errors.push(`Entry "${presentation}": "start_at" must be a stage id.`);
      entry.push({ presentation, start_at: start || stages[0]?.id || "S1" });
    });
  } else if (isObj(input.entry)) {
    excludes.push(...strList(input.entry.excludes));
  }

  const flare = isObj(input.flare_up)
    ? { trigger: str(input.flare_up.trigger), action: str(input.flare_up.action), return: str(input.flare_up.return) }
    : null;

  if (errors.length) return { valid: false, errors };

  return {
    valid: true,
    pathway: {
      format: "athena-pathway-v1",
      name,
      region: str(input.region),
      pathology: str(input.pathology),
      premise: str(input.premise),
      who: str(input.who) || (isObj(input.entry) ? str(input.entry.for) : ""),
      entry,
      excludes: Array.from(new Set(excludes)),
      progress_rule: readRule(input.progress_rule) ?? STANDARD_PROGRESS_RULE,
      flare_up: flare && (flare.trigger || flare.action || flare.return) ? flare : null,
      goals: strList(input.goals),
      stages,
      decisions,
    },
  };
}

/** Where a client with this presentation starts. */
export function entryStage(p: AthenaPathwayV1, presentation: string): PathwayStage | null {
  const match = p.entry.find((e) => e.presentation === presentation);
  return p.stages.find((s) => s.id === match?.start_at) ?? p.stages[0] ?? null;
}

/** The stage that follows this one, skipping over a decision by taking its first option. */
export function nextStage(p: AthenaPathwayV1, stageId: string): PathwayStage | null {
  const stage = p.stages.find((s) => s.id === stageId);
  let target = stage?.next ?? null;
  const seen = new Set<string>();
  while (target && !seen.has(target)) {
    seen.add(target);
    const s = p.stages.find((x) => x.id === target);
    if (s) return s;
    const d = p.decisions.find((x) => x.id === target);
    target = d?.options[0]?.go_to ?? null;
  }
  if (!stage) return null;
  const idx = p.stages.indexOf(stage);
  return stage.next === null && idx >= 0 ? p.stages[idx + 1] ?? null : null;
}

export function pathwayToCode(p: AthenaPathwayV1): string {
  return JSON.stringify(p, null, 2);
}
