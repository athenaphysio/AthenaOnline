import "server-only";
import { anthropic } from "@/lib/anthropic";
import { extractDocxText } from "@/lib/docxText";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { HUB_FIELDS, HUB_SECTIONS } from "@/lib/onboardingHub";

// Reads a document (a medical report, psychometric results, a lab summary,
// a registration form, or a consultation transcript) and places what it
// genuinely says into the fields of the consultation hub. Nothing read
// here is treated as known: every value arrives as "to confirm" for Dr
// David Silver PhD to check with the client.

const SYSTEM_PROMPT = `You read clinical and personal documents about one client of a health and performance programme and place what they say into the fields of a structured onboarding record.

Rules:
- Use only what the document genuinely states. Never infer, guess, generalise or add clinical interpretation. If a field is not covered, return an empty string for it.
- Keep the client's own words where the document gives them, especially for goals, reasons and their own explanation of symptoms. In a transcript, quote the client for fields marked verbatim.
- Be concise: a short phrase or one or two sentences per field, with numbers, dates and units kept exactly as written.
- Scale fields take a number from 0 to 10 only when the document states that score directly for that question. Do not convert other questionnaire scores into these scales; leave the scale empty instead.
- Use British English. Do not use dashes as punctuation.
- Separately, list any safety concern the document raises (for example chest pain, unexplained weight loss, thoughts of self harm, a red flag named by a doctor) in safety_notes, exactly as stated. Leave it empty if there is none.

This is real clinical documentation, so accuracy matters more than completeness.`;

function buildSchema() {
  const properties: Record<string, { type: "string"; description: string }> = {};
  for (const s of HUB_SECTIONS) {
    for (const f of s.fields) {
      properties[f.key] = {
        type: "string",
        description: `Section ${s.number}, ${s.title}: ${f.label}.${f.hint ? ` ${f.hint}` : ""}${f.kind === "scale" ? " A whole number from 0 to 10, only if directly stated." : ""} Empty string if not stated.`,
      };
    }
  }
  properties.safety_notes = { type: "string", description: "Any safety concern raised in the document, exactly as stated. Empty string if none." };
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  } as const;
}

export type HubFileInput = { mimeType: string; buffer: Buffer } | { text: string };

async function buildUserContent(input: HubFileInput, sourceLabel: string): Promise<MessageParam["content"]> {
  const lead = `Source: ${sourceLabel}. Place what this says into the onboarding record.`;
  if ("text" in input) return [{ type: "text", text: `${lead}\n\n${input.text}` }];
  const { mimeType, buffer } = input;
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return [{ type: "text", text: `${lead}\n\n${await extractDocxText(buffer)}` }];
  }
  if (mimeType === "text/plain") return [{ type: "text", text: `${lead}\n\n${buffer.toString("utf8")}` }];
  const base64 = buffer.toString("base64");
  if (mimeType === "application/pdf") {
    return [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }, { type: "text", text: lead }];
  }
  if (mimeType === "image/jpeg" || mimeType === "image/png") {
    return [{ type: "image", source: { type: "base64", media_type: mimeType, data: base64 } }, { type: "text", text: lead }];
  }
  throw new Error("Please use a PDF, Word document, text file, or a JPEG or PNG image.");
}

export async function extractHubFields(input: HubFileInput, sourceLabel: string): Promise<{ fields: Record<string, string>; safetyNotes: string }> {
  const content = await buildUserContent(input, sourceLabel);
  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    output_config: { effort: "low", format: { type: "json_schema", schema: buildSchema() } },
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content }],
  });
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("The document could not be read.");
  const parsed = JSON.parse(textBlock.text) as Record<string, string>;
  const fields: Record<string, string> = {};
  for (const f of HUB_FIELDS) {
    let v = (parsed[f.key] ?? "").trim();
    if (f.kind === "scale" && v && !/^(10|[0-9])$/.test(v)) v = "";
    if (v) fields[f.key] = v;
  }
  return { fields, safetyNotes: (parsed.safety_notes ?? "").trim() };
}
