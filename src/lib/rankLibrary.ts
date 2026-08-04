import "server-only";
import { anthropic } from "@/lib/anthropic";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CLINICAL_REASONING_PROFILE } from "@/lib/clinicalReasoningProfile";
import { fetchExerciseLibrary, formatLibraryForPrompt } from "@/lib/exerciseLibrary";
import { slotTypeLabel, type SlotType } from "@/lib/slotTypes";

export type RankContext = {
  focus: string;
  equipment: string;
  experienceLevel: string;
  tags: string[];
};

export type RankPick = { id: string; reason: string };

function hasUsableContext(context: RankContext): boolean {
  return Boolean(context.focus.trim() || context.equipment.trim() || context.tags.length > 0);
}

type HistoryRow = {
  item_id: string;
  focus: string | null;
  equipment: string | null;
  experience_level: string | null;
  tags: string[] | null;
};

// A simple, append-only log of what Dr Silver has actually picked before
// (see picker_selection_history / /api/clinic/picker-selections). Bounded to
// the most recent rows so the prompt stays affordable however much history
// accumulates over time.
async function fetchSelectionHistory(pool: "exercises" | "blocks", slotType?: SlotType): Promise<HistoryRow[]> {
  let query = supabaseAdmin
    .from("picker_selection_history")
    .select("item_id, focus, equipment, experience_level, tags")
    .eq("pool", pool)
    .order("created_at", { ascending: false })
    .limit(150);
  if (slotType) query = query.eq("slot_type", slotType);

  const { data, error } = await query;
  if (error) return [];
  return data ?? [];
}

// Aggregated by item so repeated picks read as a track record (most-picked
// first) rather than a long, repetitive list -- keeps the prompt compact no
// matter how much history has built up.
function formatHistory(history: HistoryRow[]): string {
  if (history.length === 0) return "(no selection history yet)";

  const byItem = new Map<string, { count: number; contexts: Set<string> }>();
  for (const h of history) {
    const bucket = byItem.get(h.item_id) ?? { count: 0, contexts: new Set<string>() };
    bucket.count += 1;
    const parts = [h.focus, h.experience_level, h.equipment, ...(h.tags ?? [])].filter(
      (p): p is string => Boolean(p && p.trim())
    );
    if (parts.length > 0) bucket.contexts.add(parts.slice(0, 4).join(", "));
    byItem.set(h.item_id, bucket);
  }

  return Array.from(byItem.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 40)
    .map(([itemId, b]) => `- id=${itemId} | picked ${b.count}x | past contexts: ${Array.from(b.contexts).slice(0, 3).join(" / ")}`)
    .join("\n");
}

function buildSchema() {
  return {
    type: "object",
    properties: {
      picks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            reason: { type: "string" },
          },
          required: ["id", "reason"],
          additionalProperties: false,
        },
      },
    },
    required: ["picks"],
    additionalProperties: false,
  } as const;
}

function buildSystemPrompt(poolLabel: string, candidatesText: string, context: RankContext, historyText: string): string {
  return `You are helping Dr David Silver quickly find the most relevant items in his own exercise library while he builds a programme.

CLINICAL REASONING PROFILE (how Dr Silver reasons — apply this style; never contradict it):
${CLINICAL_REASONING_PROFILE}

CONTEXT FOR THIS PROGRAMME:
- Focus: ${context.focus.trim() || "not specified"}
- Equipment available: ${context.equipment.trim() || "not specified"}
- Experience level: ${context.experienceLevel.trim() || "not specified"}
- Clinical descriptors: ${context.tags.length ? context.tags.join(", ") : "none given"}

YOUR PAST SELECTIONS (a simple log of what Dr Silver has actually picked before, most-picked first — genuine evidence of what he reaches for, not just a theoretical match):
${historyText}

When a candidate has a strong track record in past contexts similar to this one, treat that as real signal and say so plainly in its reason (e.g. "your usual pick for band-only shoulder work"). History only ever changes ORDER, never what's available — it is one more input into your clinical judgement, not a substitute for it. Don't rank something highly on history alone if it's a poor fit for the current context, and don't invent a history connection that isn't actually there in the log above.

TASK: rank the ${poolLabel} below by relevance to this context, and return only the strongest matches (at most 8) — the ones Dr Silver is most likely to reach for first. This is a *suggestion of order only*: you are not selecting, adding, or building anything, just surfacing the most relevant items so he can find them faster. He remains completely free to pick anything else from his full library instead.

HARD RULE: only ever reference an item by an id that literally appears in the list below. Never invent one.

For each pick, write a very short reason (5 words or fewer, e.g. "posterior-chain, moderate irritability, band") naming the specific attributes that made it relevant, so Dr Silver can tell at a glance whether this correctly read the context.

If fewer than 8 items are genuinely relevant, return fewer — never pad with weak matches. Confidently forcing a weak match to the top is worse than an honest gap: if truly nothing here is a good fit, return an empty "picks" array and mean it.

Available ${poolLabel}:
${candidatesText}`;
}

async function callRankModel(
  byId: Map<string, unknown>,
  poolLabel: string,
  candidatesText: string,
  context: RankContext,
  historyText: string
): Promise<RankPick[]> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: buildSchema() },
    },
    system: [{ type: "text", text: buildSystemPrompt(poolLabel, candidatesText, context, historyText) }],
    messages: [{ role: "user", content: "Rank the library for this context." }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return [];

  const parsed = JSON.parse(textBlock.text) as { picks: RankPick[] };

  // Defense in depth: never trust the model's id compliance blindly -- drop
  // anything that isn't a real candidate rather than surfacing a dead pick.
  return parsed.picks.filter((p) => byId.has(p.id)).slice(0, 8);
}

export async function rankExercises(context: RankContext): Promise<RankPick[]> {
  if (!hasUsableContext(context)) return [];

  const library = await fetchExerciseLibrary();
  if (library.length === 0) return [];
  const byId = new Map(library.map((e) => [e.exercise_id, e]));
  const candidatesText = formatLibraryForPrompt(library);
  const historyText = formatHistory(await fetchSelectionHistory("exercises"));

  return callRankModel(byId, "exercises", candidatesText, context, historyText);
}

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

async function fetchBlocksByType(type: SlotType) {
  const { data, error } = await supabaseAdmin
    .from("blocks")
    .select(
      "id, name, type, block_length_weeks, block_items(item_order, block_item_weeks(week_number, exercises(name_clinical, body_site, equipment, difficulty)))"
    )
    .eq("type", type)
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
    return { id: b.id, name: b.name, block_length_weeks: b.block_length_weeks, exerciseSummaries };
  });
}

export async function rankBlocks(slotType: SlotType, context: RankContext): Promise<RankPick[]> {
  if (!hasUsableContext(context)) return [];

  const blocks = await fetchBlocksByType(slotType);
  if (blocks.length === 0) return [];
  const byId = new Map(blocks.map((b) => [b.id, b]));
  const candidatesText = blocks
    .map(
      (b) =>
        `- id=${b.id} | "${b.name}" | ${b.block_length_weeks}wk | contains: ${
          b.exerciseSummaries.join("; ") || "(no exercises listed)"
        }`
    )
    .join("\n");
  const historyText = formatHistory(await fetchSelectionHistory("blocks", slotType));

  return callRankModel(byId, `${slotTypeLabel(slotType)} blocks`, candidatesText, context, historyText);
}
