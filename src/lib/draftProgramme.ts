import "server-only";
import { anthropic } from "@/lib/anthropic";
import { CLINICAL_REASONING_PROFILE } from "@/lib/clinicalReasoningProfile";
import { fetchExerciseLibrary, formatLibraryForPrompt } from "@/lib/exerciseLibrary";

export type DraftExercise = {
  exercise_id: string;
  name: string;
  sets: number | null;
  reps: number | null;
  hold_seconds: number | null;
  frequency: string | null;
  rationale: string;
};

export type ProgrammeDraft = {
  block: string;
  exercises: DraftExercise[];
  assumptions: string[];
  confirmations: string[];
  warnings: string[];
};

const DRAFT_SCHEMA = {
  type: "object",
  properties: {
    block: { type: "string" },
    exercises: {
      type: "array",
      items: {
        type: "object",
        properties: {
          exercise_id: { type: "string" },
          sets: { type: ["integer", "null"] },
          reps: { type: ["integer", "null"] },
          hold_seconds: { type: ["integer", "null"] },
          frequency: { type: ["string", "null"] },
          rationale: { type: "string" },
        },
        required: ["exercise_id", "sets", "reps", "hold_seconds", "frequency", "rationale"],
        additionalProperties: false,
      },
    },
    assumptions: { type: "array", items: { type: "string" } },
    confirmations: { type: "array", items: { type: "string" } },
  },
  required: ["block", "exercises", "assumptions", "confirmations"],
  additionalProperties: false,
} as const;

function buildSystemPrompt(libraryText: string): string {
  return `You are a clinical exercise-programme drafting assistant for a physiotherapist, Dr David Silver, at Athena Physio.

CLINICAL REASONING PROFILE (how Dr Silver reasons — apply this style; never contradict it):
${CLINICAL_REASONING_PROFILE}

EXERCISE LIBRARY (the ONLY exercises that exist — one per line, pipe-delimited fields):
${libraryText}

DIVISION OF LABOUR — READ CAREFULLY:
Dr Silver has already made the clinical decisions. The brief he pastes states the primary driver, irritability, stage, and goal. You do NOT revisit, second-guess, or override any of these. You work strictly inside the frame he has set. Your job is only to:
1. Select a small, selective handful of exercises from the library above that fit the stated driver, stage, irritability, and demands.
2. Set the prescription for each (sets, reps or hold time, frequency).
3. Write a plain-English, patient-facing rationale for each exercise.
4. Explicitly state what you assumed, and what only Dr Silver can confirm.

HARD RULES:
- Only ever reference an exercise by an exercise_id that literally appears in the EXERCISE LIBRARY above. Never invent one.
- Be selective. A handful of exercises that move the needle — not a generic batch. A long list means you have misunderstood the job.
- If the brief's GOAL field says "NONE YET" (or is otherwise absent), do not invent a goal. State this plainly and add an item to "confirmations" asking Dr Silver for the goal.
- Do not override anything stated in the brief. If you believe something in the brief is questionable, note it as an assumption — do not quietly substitute your own view.
- "assumptions" and "confirmations" must NEVER be empty arrays. There is always something you assumed, and always something only the clinician can confirm (e.g. the patient's actual response and tolerance, real-world access to equipment, adherence). A draft that claims total certainty is wrong.

OUTPUT: "block" is one short paragraph stating what this programme is building and to which marker or review point. "exercises" is the selective list with id, prescription, and rationale. "assumptions" and "confirmations" are explicit, specific bullet-style items — never generic filler.`;
}

export class InvalidBriefError extends Error {}

export async function draftPrescription(brief: string): Promise<ProgrammeDraft> {
  const trimmed = brief.trim();
  if (!trimmed) {
    throw new InvalidBriefError("Brief is empty.");
  }

  const library = await fetchExerciseLibrary();
  const byId = new Map(library.map((e) => [e.exercise_id, e]));
  const libraryText = formatLibraryForPrompt(library);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 12000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "high",
      format: {
        type: "json_schema",
        schema: DRAFT_SCHEMA,
      },
    },
    system: [
      {
        type: "text",
        text: buildSystemPrompt(libraryText),
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
    exercises: Omit<DraftExercise, "name">[];
    assumptions: string[];
    confirmations: string[];
  };

  // Defense in depth: the hard rule says the model must never invent an
  // exercise ID. Even with a constrained schema, verify against the real
  // library rather than trusting the model's compliance blindly.
  const warnings: string[] = [];
  const validExercises: DraftExercise[] = [];
  for (const ex of parsed.exercises) {
    const match = byId.get(ex.exercise_id);
    if (!match) {
      warnings.push(`Removed "${ex.exercise_id}" — not a real exercise in your library.`);
      continue;
    }
    validExercises.push({ ...ex, name: match.name_clinical });
  }

  return {
    block: parsed.block,
    exercises: validExercises,
    assumptions: parsed.assumptions,
    confirmations: parsed.confirmations,
    warnings,
  };
}
