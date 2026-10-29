import "server-only";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { anthropic } from "@/lib/anthropic";
import { extractDocxText } from "@/lib/docxText";
import { CONTEXT_SCALES, CONTEXT_SECTIONS, normaliseContext, type ContextContent } from "@/lib/clientContext";

// Reads a Twofold notes export from an onboarding consultation and sorts it
// into the Onboarding Consultation Framework. Only runs when the clinic's AI
// tools switch is on. The result is always a draft that Dr David Silver PhD
// checks and corrects before anything is saved.

const SECTION_KEYS = CONTEXT_SECTIONS.map((s) => s.key);
const SCALE_KEYS = CONTEXT_SCALES.map((s) => s.key);

function schema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["sections", "scales", "goals", "flags", "anchor_statement", "top_priority", "first_action", "referral"],
    properties: {
      sections: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["key", "summary", "fields", "quotes", "codes"],
          properties: {
            key: { type: "string", enum: SECTION_KEYS },
            summary: { type: "string", description: "Two or three plain sentences on what the notes say for this section. Empty string if the section was not covered." },
            fields: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["label", "value"],
                properties: { label: { type: "string" }, value: { type: "string" } },
              },
            },
            quotes: { type: "array", items: { type: "string" }, description: "The client's own words, copied exactly from the notes. Only text clearly marked or presented as a quote." },
            codes: { type: "array", items: { type: "string" }, description: "Codes from the framework already tagged in the notes, or clearly evident, for example FEAR AVOIDANCE + FEAR." },
          },
        },
      },
      scales: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["key", "score"],
          properties: {
            key: { type: "string", enum: SCALE_KEYS },
            score: { type: ["number", "null"], description: "The 0 to 10 score the notes record for this scale, or null if not recorded. Never estimate." },
          },
        },
      },
      goals: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["goal", "value", "importance"],
          properties: {
            goal: { type: "string", description: "The goal in the client's own words." },
            value: { type: "string", description: "The value or reason beneath it, if stated." },
            importance: { type: ["number", "null"] },
          },
        },
      },
      flags: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["kind", "text"],
          properties: {
            kind: { type: "string", enum: ["red_flag", "referral", "note"] },
            text: { type: "string" },
          },
        },
      },
      anchor_statement: { type: "string" },
      top_priority: { type: "string" },
      first_action: { type: "string" },
      referral: {
        type: "object",
        additionalProperties: false,
        required: ["presenting_complaint", "date_of_onset", "mechanism_of_injury", "referred_via", "referral_goals_history"],
        properties: {
          presenting_complaint: { type: "string" },
          date_of_onset: { type: "string" },
          mechanism_of_injury: { type: "string" },
          referred_via: { type: "string" },
          referral_goals_history: { type: "string" },
        },
      },
    },
  } as const;
}

function systemPrompt(): string {
  const sections = CONTEXT_SECTIONS.map(
    (s) => `${s.number}. ${s.title} (key "${s.key}"). Capture fields, use these exact labels: ${s.capture.map((c) => `"${c}"`).join(", ")}.`
  ).join("\n");
  const scales = CONTEXT_SCALES.map((s) => `- "${s.key}": "${s.question}"`).join("\n");
  return `You are organising a physiotherapist's notes from an extended onboarding consultation into his consultation framework. The notes are usually an export from Twofold, an AI medical scribe, and may use inline tags: [Q] verbatim quote, [G] goal, [V] value or meaning, [B] barrier, [E] enabler, [EMO: tone] emotional tone, [F] flag, [A] agreed action.

The framework's fourteen sections:
${sections}

The 0 to 10 scales, asked with these exact words:
${scales}

Rules:
1. Record only what the notes actually say. Never invent, infer or estimate anything, especially scores, diagnoses, dates or quotes. If something is not in the notes, leave it empty, or null for a score.
2. Quotes must be copied word for word from the notes.
3. Return every one of the fourteen sections, even if empty, with each capture field labelled exactly as given.
4. Goals: at most three, in the client's own words.
5. Flags: "red_flag" for any medical red flag, cardiovascular screening positive, or disclosure of risk or significant distress; "referral" for any referral need or agreed referral; "note" for anything else that should shape the plan.
6. anchor_statement, top_priority and first_action: only if stated or agreed in the notes.
7. referral: the presenting complaint or reason for attending, onset, mechanism, who referred them, and goals or relevant history, only if stated.
8. Use British English. Do not use em or en dashes.`;
}

async function content(mimeType: string, buffer: Buffer): Promise<MessageParam["content"]> {
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return [{ type: "text", text: `Consultation notes:\n\n${await extractDocxText(buffer)}` }];
  }
  if (mimeType === "text/plain" || mimeType === "text/markdown") {
    return [{ type: "text", text: `Consultation notes:\n\n${buffer.toString("utf8")}` }];
  }
  if (mimeType === "application/pdf") {
    return [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") } },
      { type: "text", text: "These are the consultation notes to organise." },
    ];
  }
  throw new Error(`Unsupported notes file type: ${mimeType}`);
}

export async function extractClientContext(mimeType: string, buffer: Buffer): Promise<ContextContent> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 12000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: { type: "json_schema", schema: schema() } },
    system: [{ type: "text", text: systemPrompt(), cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: await content(mimeType, buffer) }],
  });
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("No reading came back.");
  return normaliseContext(JSON.parse(text.text) as Partial<ContextContent>);
}
