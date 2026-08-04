import "server-only";
import { anthropic } from "@/lib/anthropic";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CLINICAL_REASONING_PROFILE } from "@/lib/clinicalReasoningProfile";

type CandidateBlock = {
  id: string;
  name: string;
  type: string;
  block_length_weeks: number;
  exerciseSummaries: string[];
};

type RawBlockRow = {
  id: string;
  name: string;
  type: string;
  block_length_weeks: number;
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
      "id, name, type, block_length_weeks, block_items(item_order, block_item_weeks(week_number, exercises(name_clinical, body_site, equipment, difficulty)))"
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
    return { id: b.id, name: b.name, type: b.type, block_length_weeks: b.block_length_weeks, exerciseSummaries };
  });
}

function formatCandidates(blocks: CandidateBlock[], type: BookendType): string {
  const filtered = blocks.filter((b) => b.type === type);
  if (filtered.length === 0) return "(you have no blocks of this type yet)";
  return filtered
    .map((b) => `- id=${b.id} | "${b.name}" | ${b.block_length_weeks}wk | contains: ${b.exerciseSummaries.join("; ") || "(no exercises listed)"}`)
    .join("\n");
}

function buildSchema() {
  return {
    type: "object",
    properties: {
      warm_up_block_id: { type: ["string", "null"] },
      activation_block_id: { type: ["string", "null"] },
      cool_down_block_id: { type: ["string", "null"] },
      injury_prevention_block_id: { type: ["string", "null"] },
      notices: { type: "array", items: { type: "string" } },
      context_tags: { type: "array", items: { type: "string" } },
    },
    required: [
      "warm_up_block_id",
      "activation_block_id",
      "cool_down_block_id",
      "injury_prevention_block_id",
      "notices",
      "context_tags",
    ],
    additionalProperties: false,
  } as const;
}

function buildSystemPrompt(blocks: CandidateBlock[]): string {
  return `You are helping Dr David Silver quickly scaffold a new training programme at Athena Physio.

CLINICAL REASONING PROFILE (how Dr Silver reasons — apply this style; never contradict it):
${CLINICAL_REASONING_PROFILE}

He will build the main strength/rehab work himself. Your ONLY job here is picking sensible WARM-UP, ACTIVATION, COOL-DOWN, and — only if clearly relevant — INJURY-PREVENTION blocks from his own existing library, to bookend the session. You are never asked about, and must never suggest, anything for "main body" — that slot is intentionally his to fill.

HARD RULE: you may only select a block by an id that literally appears in the lists below. Never invent one. If nothing in a category is a genuinely good fit for the stated focus, equipment, and experience level, set that field to null and say why in "notices" — leaving a slot empty is the correct, expected outcome when nothing fits. A bad guess is worse than an honest gap.

INJURY PREVENTION is the exception category, not the default: only pick one if the stated focus obviously implies a specific region prone to injury in that context (e.g. shoulder training commonly pairs with rotator-cuff/scapular control work) AND a real block below is a genuine fit. If the focus is vague, general, or nothing fits well, leave this null.

Your available blocks, by type:

WARM-UP:
${formatCandidates(blocks, "warm_up")}

ACTIVATION:
${formatCandidates(blocks, "activation")}

COOL-DOWN:
${formatCandidates(blocks, "cool_down")}

INJURY PREVENTION:
${formatCandidates(blocks, "injury_prevention")}

OUTPUT: the four *_block_id fields (each either a real id from the matching list above, or null), and "notices" — one short, plain-English line for every slot you left null, explaining why (e.g. "No warm-up block suited to shoulder work with no equipment — left empty."). If you filled every slot you considered filling, "notices" can be an empty array.

Also produce "context_tags": up to 5 short clinical/movement descriptor phrases (2-4 words each, e.g. "shoulder", "post-fall", "moderate irritability", "beginner", "bands only") that summarise the clinical picture for later use elsewhere in the tool. These get shown to Dr Silver and used to re-rank his exercise library later, so they must be pure clinical/movement descriptors — NEVER a name, date of birth, or any other identifying detail, even if one appears in the brief above. If the brief contains identifying details, simply omit them from the tags; only the focus/equipment/experience level and genuine clinical descriptors belong here.`;
}

export type ScaffoldPicks = {
  warm_up_block_id: string | null;
  activation_block_id: string | null;
  cool_down_block_id: string | null;
  injury_prevention_block_id: string | null;
  notices: string[];
  context_tags: string[];
};

export async function draftScaffoldPicks(input: {
  focus: string;
  equipment: string;
  experienceLevel: string;
  brief: string;
}): Promise<ScaffoldPicks> {
  const blocks = await fetchCandidateBlocks();
  const byId = new Map(blocks.map((b) => [b.id, b]));

  const userPrompt = `FOCUS: ${input.focus}
EQUIPMENT AVAILABLE: ${input.equipment || "not specified"}
EXPERIENCE LEVEL: ${input.experienceLevel}
CLINICAL BRIEF: ${input.brief.trim() || "(none provided)"}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: buildSchema() },
    },
    system: [{ type: "text", text: buildSystemPrompt(blocks), cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude.");
  }

  const parsed = JSON.parse(textBlock.text) as ScaffoldPicks;
  const notices = [...parsed.notices];

  // Defense in depth: verify every returned id is real and actually of the
  // expected type, exactly as draftBlock.ts does for exercise ids. Never
  // trust the model's compliance with the schema alone.
  function validate(id: string | null, type: BookendType, label: string): string | null {
    if (!id) return null;
    const block = byId.get(id);
    if (!block || block.type !== type) {
      notices.push(`Suggested an invalid ${label} block — left that slot empty instead.`);
      return null;
    }
    return id;
  }

  return {
    warm_up_block_id: validate(parsed.warm_up_block_id, "warm_up", "warm-up"),
    activation_block_id: validate(parsed.activation_block_id, "activation", "activation"),
    cool_down_block_id: validate(parsed.cool_down_block_id, "cool_down", "cool-down"),
    injury_prevention_block_id: validate(parsed.injury_prevention_block_id, "injury_prevention", "injury-prevention"),
    notices,
    context_tags: (parsed.context_tags ?? []).slice(0, 5),
  };
}
