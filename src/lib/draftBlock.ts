import "server-only";
import { anthropic } from "@/lib/anthropic";
import { CLINICAL_REASONING_PROFILE } from "@/lib/clinicalReasoningProfile";
import { fetchExerciseLibrary, formatLibraryForPrompt } from "@/lib/exerciseLibrary";

export type DraftWeek = {
  week_number: number;
  exercise_id: string;
  name: string;
  rationale: string;
  sets: number | null;
  reps: number | null;
  hold_seconds: number | null;
  percent_max: number | null;
  frequency: string | null;
};

export type DraftSlot = {
  weeks: DraftWeek[];
};

export type BlockDraft = {
  block: string;
  slots: DraftSlot[];
  assumptions: string[];
  confirmations: string[];
  warnings: string[];
};

function buildSchema(blockLengthWeeks: number) {
  return {
    type: "object",
    properties: {
      block: { type: "string" },
      slots: {
        type: "array",
        items: {
          type: "object",
          properties: {
            weeks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  week_number: { type: "integer" },
                  exercise_id: { type: "string" },
                  rationale: { type: "string" },
                  sets: { type: ["integer", "null"] },
                  reps: { type: ["integer", "null"] },
                  hold_seconds: { type: ["integer", "null"] },
                  percent_max: { type: ["integer", "null"] },
                  frequency: { type: ["string", "null"] },
                },
                required: [
                  "week_number",
                  "exercise_id",
                  "rationale",
                  "sets",
                  "reps",
                  "hold_seconds",
                  "percent_max",
                  "frequency",
                ],
                additionalProperties: false,
              },
            },
          },
          required: ["weeks"],
          additionalProperties: false,
        },
      },
      assumptions: { type: "array", items: { type: "string" } },
      confirmations: { type: "array", items: { type: "string" } },
    },
    required: ["block", "slots", "assumptions", "confirmations"],
    additionalProperties: false,
  } as const;
}

function buildSystemPrompt(libraryText: string, blockLengthWeeks: number): string {
  return `You are a clinical exercise-programme drafting assistant for a physiotherapist, Dr David Silver, at Athena Physio.

CLINICAL REASONING PROFILE (how Dr Silver reasons — apply this style; never contradict it):
${CLINICAL_REASONING_PROFILE}

EXERCISE LIBRARY (the ONLY exercises that exist — one per line, pipe-delimited fields):
${libraryText}

DIVISION OF LABOUR — READ CAREFULLY:
Dr Silver has already made the clinical decisions. The brief he pastes states the primary driver, irritability, stage, and goal. You do NOT revisit, second-guess, or override any of these. You work strictly inside the frame he has set. Your job is only to:
1. Select a small, selective handful of exercise "slots" that fit the stated driver, stage, irritability, and demands.
2. For each slot, decide what fills it in each week of the block — the prescription, and optionally the exercise itself.
3. Write a plain-English, patient-facing rationale for each week's exercise.
4. Explicitly state what you assumed, and what only Dr Silver can confirm.

THIS BLOCK RUNS FOR ${blockLengthWeeks} WEEKS. Every slot needs a "weeks" array with exactly ${blockLengthWeeks} entries, one per week_number from 1 to ${blockLengthWeeks} in order. Each week entry carries its own exercise_id and rationale, not just numbers — this means a slot CAN progress into a genuinely different, harder exercise partway through the block, not just heavier numbers on the same one.

DEFAULT TO KEEPING THE SAME EXERCISE across all weeks in a slot — that is the normal case. Only change the exercise_id partway through a slot when there is a real clinical reason (the patient has plausibly outgrown the easier variant and a harder one in the library serves the same movement pattern and driver better). If you do change the exercise within a slot, say so explicitly and briefly in "assumptions", naming which week the change happens and why.

PERCENT OF MAX ("percent_max"): only set this when the brief gives you a genuine basis to calculate from (a tested or stated working max). If there is no tested max mentioned, leave percent_max null and describe load qualitatively instead (in the rationale or frequency text) — inventing a precise percentage with nothing to base it on is a fabrication, not a clinical judgement.

HARD RULES:
- Only ever reference an exercise by an exercise_id that literally appears in the EXERCISE LIBRARY above. Never invent one.
- Be selective. A handful of slots that move the needle — not a generic batch. A long list means you have misunderstood the job.
- If the brief's GOAL field says "NONE YET" (or is otherwise absent), do not invent a goal. State this plainly and add an item to "confirmations" asking Dr Silver for the goal.
- Do not override anything stated in the brief. If you believe something in the brief is questionable, note it as an assumption — do not quietly substitute your own view.
- "assumptions" and "confirmations" must NEVER be empty arrays. There is always something you assumed (including your progression reasoning), and always something only the clinician can confirm (e.g. the patient's actual response and tolerance, real-world access to equipment, adherence). A draft that claims total certainty is wrong.

OUTPUT: "block" is one short paragraph stating what this programme is building and to which marker or review point. "slots" is the selective list, each with a full ${blockLengthWeeks}-week grid. "assumptions" and "confirmations" are explicit, specific bullet-style items — never generic filler.`;
}

export class InvalidBriefError extends Error {}

type RawWeek = Omit<DraftWeek, "name">;

function normalizeWeeks(weeks: RawWeek[], blockLengthWeeks: number): RawWeek[] {
  const byWeek = new Map(weeks.map((w) => [w.week_number, w]));
  const result: RawWeek[] = [];
  let lastKnown: RawWeek | null = null;
  for (let n = 1; n <= blockLengthWeeks; n++) {
    const existing = byWeek.get(n);
    if (existing) {
      lastKnown = existing;
      result.push(existing);
    } else if (lastKnown) {
      result.push({ ...lastKnown, week_number: n });
    } else {
      result.push({
        week_number: n,
        exercise_id: "",
        rationale: "",
        sets: null,
        reps: null,
        hold_seconds: null,
        percent_max: null,
        frequency: null,
      });
    }
  }
  return result;
}

export async function draftBlock(
  brief: string,
  blockLengthWeeks: number
): Promise<BlockDraft> {
  const trimmed = brief.trim();
  if (!trimmed) {
    throw new InvalidBriefError("Brief is empty.");
  }
  if (!Number.isInteger(blockLengthWeeks) || blockLengthWeeks < 1 || blockLengthWeeks > 12) {
    throw new InvalidBriefError("Block length must be between 1 and 12 weeks.");
  }

  const library = await fetchExerciseLibrary();
  const byId = new Map(library.map((e) => [e.exercise_id, e]));
  const libraryText = formatLibraryForPrompt(library);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: {
        type: "json_schema",
        schema: buildSchema(blockLengthWeeks),
      },
    },
    system: [
      {
        type: "text",
        text: buildSystemPrompt(libraryText, blockLengthWeeks),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: trimmed }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude.");
  }

  const parsed = JSON.parse(textBlock.text) as {
    block: string;
    slots: { weeks: RawWeek[] }[];
    assumptions: string[];
    confirmations: string[];
  };

  // Defense in depth: the hard rule says the model must never invent an
  // exercise ID. Even with a constrained schema, verify every week's
  // exercise against the real library rather than trusting compliance
  // blindly. An invalid mid-block swap falls back to the last valid
  // exercise in that slot; an invalid week 1 (no fallback available) drops
  // the whole slot.
  const warnings: string[] = [];
  const validSlots: DraftSlot[] = [];

  for (const slot of parsed.slots) {
    const normalized = normalizeWeeks(slot.weeks, blockLengthWeeks);
    const resolvedWeeks: DraftWeek[] = [];
    let lastValid: RawWeek | null = null;

    for (const week of normalized) {
      const match = byId.get(week.exercise_id);
      if (match) {
        lastValid = week;
        resolvedWeeks.push({ ...week, name: match.name_clinical });
      } else if (lastValid) {
        warnings.push(
          `Week ${week.week_number}: "${week.exercise_id}" isn't a real exercise — kept the previous week's exercise instead.`
        );
        const fallbackMatch = byId.get(lastValid.exercise_id)!;
        resolvedWeeks.push({ ...lastValid, week_number: week.week_number, name: fallbackMatch.name_clinical });
      } else {
        warnings.push(`Removed a slot — "${week.exercise_id}" isn't a real exercise in your library.`);
      }
    }

    if (resolvedWeeks.length === blockLengthWeeks) {
      validSlots.push({ weeks: resolvedWeeks });
    }
  }

  return {
    block: parsed.block,
    slots: validSlots,
    assumptions: parsed.assumptions,
    confirmations: parsed.confirmations,
    warnings,
  };
}
