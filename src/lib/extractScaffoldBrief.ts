import "server-only";
import { anthropic } from "@/lib/anthropic";

export type ScaffoldBriefFields = {
  focus: string;
  weeks: number;
  sessions_per_week: number;
  equipment: string;
  experience_level: "beginner" | "intermediate" | "advanced";
};

function buildSchema() {
  return {
    type: "object",
    properties: {
      focus: {
        type: "string",
        description:
          "The sport, event, or training focus described, in a few words -- e.g. 'Rugby S&C', 'Post-ACL return to sport', 'General strength'. Empty string only if genuinely not mentioned at all.",
      },
      weeks: { type: "integer", minimum: 1, maximum: 12 },
      sessions_per_week: { type: "integer", minimum: 1, maximum: 7 },
      equipment: {
        type: "string",
        description:
          "Equipment available, in a few words -- e.g. 'Full gym', 'Dumbbells and bands only'. Empty string if not mentioned.",
      },
      experience_level: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
    },
    required: ["focus", "weeks", "sessions_per_week", "equipment", "experience_level"],
    additionalProperties: false,
  } as const;
}

const SYSTEM_PROMPT = `You are extracting five structured fields from a clinician's short spoken brief, transcribed to text, describing a new training programme he's about to build at Athena Physio.

Pull out exactly: focus/sport, number of weeks, sessions per week, equipment available, and experience level. Speech-to-text transcripts are informal and sometimes imprecise -- read for the clinician's actual meaning, not literal wording.

If a number (weeks, sessions per week) genuinely isn't mentioned, make a reasonable default: 4 weeks, 3 sessions per week. If experience level isn't mentioned, default to "intermediate". If equipment isn't mentioned, leave it an empty string rather than guessing. Never invent a focus if none was said at all -- an empty string there is the honest, correct output; the clinician will fill it in by hand.

Map experience level to the single closest of exactly three bands (beginner / intermediate / advanced) even if the clinician used different words (e.g. "pretty fit, moderate-to-high level" -> advanced; "just starting out" -> beginner).`;

export async function extractScaffoldBrief(transcript: string): Promise<ScaffoldBriefFields> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: buildSchema() },
    },
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: transcript }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude.");
  }

  const parsed = JSON.parse(textBlock.text) as ScaffoldBriefFields;

  // Defense in depth on the numeric fields, same spirit as draftScaffold.ts
  // validating block ids -- never trust schema compliance alone.
  return {
    focus: parsed.focus?.trim() ?? "",
    weeks: Math.max(1, Math.min(12, Math.round(parsed.weeks) || 4)),
    sessions_per_week: Math.max(1, Math.min(7, Math.round(parsed.sessions_per_week) || 3)),
    equipment: parsed.equipment?.trim() ?? "",
    experience_level: (["beginner", "intermediate", "advanced"] as const).includes(parsed.experience_level)
      ? parsed.experience_level
      : "intermediate",
  };
}
