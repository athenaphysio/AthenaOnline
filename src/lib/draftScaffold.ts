import "server-only";
import { anthropic } from "@/lib/anthropic";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CLINICAL_REASONING_PROFILE } from "@/lib/clinicalReasoningProfile";

type CandidateBlock = {
  id: string;
  name: string;
  type: string;
  block_length_weeks: number;
  phaseId: string | null;
  phaseName: string | null;
  conditionUseCase: string | null;
  contraindicationFlags: string | null;
  notes: string | null;
  exerciseSummaries: string[];
};

type RawBlockRow = {
  id: string;
  name: string;
  type: string;
  block_length_weeks: number;
  phase_id: string | null;
  phase_tags: { name: string } | null;
  block_notes: { condition_use_case: string | null; contraindication_flags: string | null; notes: string | null } | null;
  block_items: {
    item_order: number;
    block_item_weeks: {
      week_number: number;
      exercises: {
        name_clinical: string;
        body_site: string | null;
        equipment: string | null;
        difficulty: string | null;
      } | null;
    }[];
  }[];
};

const BOOKEND_TYPES = ["warm_up", "activation", "cool_down", "injury_prevention"] as const;
type BookendType = (typeof BOOKEND_TYPES)[number];

async function fetchCandidateBlocks(): Promise<CandidateBlock[]> {
  const { data, error } = await supabaseAdmin
    .from("blocks")
    .select(
      "id, name, type, block_length_weeks, phase_id, phase_tags(name), block_notes(condition_use_case, contraindication_flags, notes), block_items(item_order, block_item_weeks(week_number, exercises(name_clinical, body_site, equipment, difficulty)))"
    )
    .in("type", BOOKEND_TYPES)
    .order("name")
    .returns<RawBlockRow[]>();

  if (error) throw new Error(error.message);

  return (data ?? []).map((b) => {
    const items = [...b.block_items].sort((a, c) => a.item_order - c.item_order);
    const exerciseSummaries = items
      .map((item) => {
        const weeks = item.block_item_weeks;
        const week1 = weeks.find((w) => w.week_number === 1) ?? weeks[0];
        const ex = week1?.exercises;
        if (!ex) return null;
        const details = [ex.body_site, ex.equipment, ex.difficulty].filter(Boolean).join(", ");
        return details ? `${ex.name_clinical} (${details})` : ex.name_clinical;
      })
      .filter((s): s is string => Boolean(s));
    const notes = Array.isArray(b.block_notes) ? b.block_notes[0] : b.block_notes;
    const phaseTag = Array.isArray(b.phase_tags) ? b.phase_tags[0] : b.phase_tags;
    return {
      id: b.id,
      name: b.name,
      type: b.type,
      block_length_weeks: b.block_length_weeks,
      phaseId: b.phase_id,
      phaseName: phaseTag?.name ?? null,
      conditionUseCase: notes?.condition_use_case ?? null,
      contraindicationFlags: notes?.contraindication_flags ?? null,
      notes: notes?.notes ?? null,
      exerciseSummaries,
    };
  });
}

// Layer 1 of the two-layer model: pure rule-matching, no AI, fully
// inspectable. Type is always a hard filter (a warm-up slot can never get
// an activation block). Phase is a hard filter too, but only when the
// caller supplied one -- a block with no phase set yet is treated as
// unclassified, not excluded, since most existing content predates phase
// tagging and stays neutral until David reviews it (see 0076_phase_tags.sql).
function hardFilter(blocks: CandidateBlock[], type: BookendType, phaseId: string | null): CandidateBlock[] {
  return blocks.filter((b) => b.type === type && (phaseId == null || b.phaseId == null || b.phaseId === phaseId));
}

function formatCandidates(pool: CandidateBlock[]): string {
  if (pool.length === 0) return "(no blocks of this type pass the phase filter)";
  return pool
    .map((b) => {
      const parts = [`id=${b.id}`, `"${b.name}"`, `${b.block_length_weeks}wk`];
      if (b.phaseName) parts.push(`phase=${b.phaseName}`);
      parts.push(`contains: ${b.exerciseSummaries.join("; ") || "(no exercises listed)"}`);
      if (b.conditionUseCase) parts.push(`indication: ${b.conditionUseCase}`);
      if (b.contraindicationFlags) parts.push(`contraindications: ${b.contraindicationFlags}`);
      if (b.notes) parts.push(`David's notes: ${b.notes}`);
      return `- ${parts.join(" | ")}`;
    })
    .join("\n");
}

function buildSchema() {
  const pickProps = {
    block_id: { type: ["string", "null"] },
    reason: { type: ["string", "null"] },
  };
  return {
    type: "object",
    properties: {
      warm_up: { type: "object", properties: pickProps, required: ["block_id", "reason"], additionalProperties: false },
      activation: { type: "object", properties: pickProps, required: ["block_id", "reason"], additionalProperties: false },
      cool_down: { type: "object", properties: pickProps, required: ["block_id", "reason"], additionalProperties: false },
      injury_prevention: { type: "object", properties: pickProps, required: ["block_id", "reason"], additionalProperties: false },
      notices: { type: "array", items: { type: "string" } },
      context_tags: { type: "array", items: { type: "string" } },
    },
    required: ["warm_up", "activation", "cool_down", "injury_prevention", "notices", "context_tags"],
    additionalProperties: false,
  } as const;
}

function buildSystemPrompt(pools: Record<BookendType, CandidateBlock[]>, phaseName: string | null): string {
  return `You are helping Dr David Silver quickly scaffold a new training programme at Athena Physio.

CLINICAL REASONING PROFILE (how Dr Silver reasons — apply this style; never contradict it):
${CLINICAL_REASONING_PROFILE}

He will build the main strength/rehab work himself. Your ONLY job here is picking sensible WARM-UP, ACTIVATION, COOL-DOWN, and — only if clearly relevant — INJURY-PREVENTION blocks from his own existing library, to bookend the session. You are never asked about, and must never suggest, anything for "main body" — that slot is intentionally his to fill.

The lists below are already hard-filtered by type and, where a phase was given, by programme phase; this is deterministic, non-AI filtering (matching block type, and matching phase where a block has one set). ${phaseName ? `This scaffold is for the ${phaseName} phase.` : "No phase was specified for this scaffold, so no phase filtering was applied."} You may only choose a block that appears in the matching list below, never one you recall or infer from outside it, and never one that was filtered out.

HARD RULE: you may only select a block by an id that literally appears in the lists below. Never invent one. If nothing in a category is a genuinely good fit for the stated focus, equipment, experience level, and brief, set that slot's block_id to null and say why in "notices"; leaving a slot empty is the correct, expected outcome when nothing fits. A bad guess is worse than an honest gap.

Each candidate below may carry an indication (when David uses it), contraindications (when to avoid it), and David's own notes. Read these against the stated focus and brief before picking; a block whose contraindication clearly matches the stated situation should not be picked even though it passed the type/phase filter, since contraindication is free text and can only be judged by reading it, not by mechanical filtering. When you do pick a block, its "reason" must be a short, plain-English line naming what in its indication or notes (or, absent those, its exercise contents) made it the right fit for this specific case, never an unexplained pick.

INJURY PREVENTION is the exception category, not the default: only pick one if the stated focus obviously implies a specific region prone to injury in that context (e.g. shoulder training commonly pairs with rotator-cuff/scapular control work) AND a real block below is a genuine fit. If the focus is vague, general, or nothing fits well, leave this null.

WARM-UP (candidates):
${formatCandidates(pools.warm_up)}

ACTIVATION (candidates):
${formatCandidates(pools.activation)}

COOL-DOWN (candidates):
${formatCandidates(pools.cool_down)}

INJURY PREVENTION (candidates):
${formatCandidates(pools.injury_prevention)}

OUTPUT: for each of the four slots, an object with "block_id" (a real id from that slot's list above, or null) and "reason" (your one-line justification when block_id is set, or null when it isn't). Also "notices", one short, plain-English line for every slot you left null, explaining why (e.g. "No warm-up block suited to shoulder work with no equipment, left empty."). If you filled every slot you considered filling, "notices" can be an empty array.

Also produce "context_tags": up to 5 short clinical/movement descriptor phrases (2-4 words each, e.g. "shoulder", "post-fall", "moderate irritability", "beginner", "bands only") that summarise the clinical picture for later use elsewhere in the tool. These get shown to Dr Silver and used to re-rank his exercise library later, so they must be pure clinical/movement descriptors — NEVER a name, date of birth, or any other identifying detail, even if one appears in the brief above. If the brief contains identifying details, simply omit them from the tags; only the focus/equipment/experience level and genuine clinical descriptors belong here.`;
}

export type ScaffoldPick = {
  block_id: string | null;
  reason: string | null;
  matched_tags: string[];
};

export type ScaffoldPicks = {
  warm_up: ScaffoldPick;
  activation: ScaffoldPick;
  cool_down: ScaffoldPick;
  injury_prevention: ScaffoldPick;
  notices: string[];
  context_tags: string[];
};

export async function draftScaffoldPicks(input: {
  focus: string;
  equipment: string;
  experienceLevel: string;
  brief: string;
  phaseId?: string | null;
}): Promise<ScaffoldPicks> {
  const allBlocks = await fetchCandidateBlocks();
  const byId = new Map(allBlocks.map((b) => [b.id, b]));
  const phaseId = input.phaseId ?? null;
  const phaseName = phaseId ? (allBlocks.find((b) => b.phaseId === phaseId)?.phaseName ?? null) : null;

  // Layer 1 -- hard filter, computed once per slot, before the model ever
  // sees anything. The model is shown only these pools, so it structurally
  // cannot select something the tags already ruled out.
  const pools: Record<BookendType, CandidateBlock[]> = {
    warm_up: hardFilter(allBlocks, "warm_up", phaseId),
    activation: hardFilter(allBlocks, "activation", phaseId),
    cool_down: hardFilter(allBlocks, "cool_down", phaseId),
    injury_prevention: hardFilter(allBlocks, "injury_prevention", phaseId),
  };
  const poolIds: Record<BookendType, Set<string>> = {
    warm_up: new Set(pools.warm_up.map((b) => b.id)),
    activation: new Set(pools.activation.map((b) => b.id)),
    cool_down: new Set(pools.cool_down.map((b) => b.id)),
    injury_prevention: new Set(pools.injury_prevention.map((b) => b.id)),
  };

  const userPrompt = `FOCUS: ${input.focus}
EQUIPMENT AVAILABLE: ${input.equipment || "not specified"}
EXPERIENCE LEVEL: ${input.experienceLevel}
CLINICAL BRIEF: ${input.brief.trim() || "(none provided)"}`;

  // Layer 2 -- the AI ranks within the already-filtered pool, reading the
  // free-text indication/contraindication/notes on each remaining
  // candidate against this specific case. It never sees, and so can never
  // pick, anything layer 1 already excluded.
  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: buildSchema() },
    },
    system: [{ type: "text", text: buildSystemPrompt(pools, phaseName), cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude.");
  }

  const parsed = JSON.parse(textBlock.text) as {
    warm_up: { block_id: string | null; reason: string | null };
    activation: { block_id: string | null; reason: string | null };
    cool_down: { block_id: string | null; reason: string | null };
    injury_prevention: { block_id: string | null; reason: string | null };
    notices: string[];
    context_tags: string[];
  };
  const notices = [...parsed.notices];

  // Defense in depth: verify every returned id is real, of the expected
  // type, AND actually inside the filtered pool the model was shown --
  // exactly as draftBlock.ts does for exercise ids, but also enforcing
  // layer 1's boundary rather than trusting the model kept to it.
  function validate(pick: { block_id: string | null; reason: string | null }, type: BookendType, label: string): ScaffoldPick {
    if (!pick.block_id) return { block_id: null, reason: null, matched_tags: [] };
    const block = byId.get(pick.block_id);
    if (!block || block.type !== type || !poolIds[type].has(pick.block_id)) {
      notices.push(`Suggested an invalid ${label} block — left that slot empty instead.`);
      return { block_id: null, reason: null, matched_tags: [] };
    }
    const matchedTags = [`type: ${type}`, ...(block.phaseName ? [`phase: ${block.phaseName}`] : [])];
    return { block_id: pick.block_id, reason: pick.reason, matched_tags: matchedTags };
  }

  return {
    warm_up: validate(parsed.warm_up, "warm_up", "warm-up"),
    activation: validate(parsed.activation, "activation", "activation"),
    cool_down: validate(parsed.cool_down, "cool_down", "cool-down"),
    injury_prevention: validate(parsed.injury_prevention, "injury_prevention", "injury-prevention"),
    notices,
    context_tags: (parsed.context_tags ?? []).slice(0, 5),
  };
}
