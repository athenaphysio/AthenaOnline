import "server-only";
import { anthropic } from "@/lib/anthropic";
import { extractDocxText } from "@/lib/docxText";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";

export type IntakeFormFields = {
  presenting_complaint: string;
  date_of_onset: string;
  mechanism_of_injury: string;
  body_region: string;
  referred_via: string;
  referral_goals_history: string;
};

function buildSchema() {
  return {
    type: "object",
    properties: {
      presenting_complaint: {
        type: "string",
        description: "The presenting complaint or reason for referral, in the patient's or referrer's own terms. Empty string if genuinely not stated.",
      },
      date_of_onset: {
        type: "string",
        description:
          "When symptoms started, exactly as given -- a real date, or free text like 'about three weeks ago' or 'gradual onset'. Empty string if not stated.",
      },
      mechanism_of_injury: {
        type: "string",
        description: "How the injury happened, if described (e.g. 'twisted landing from a jump'). Empty string if not stated or not applicable.",
      },
      body_region: {
        type: "string",
        description: "The body region or area affected, in a few words (e.g. 'Right knee', 'Lower back'). Empty string if not stated.",
      },
      referred_via: {
        type: "string",
        description:
          "Who or what referred this patient, or which clinic/system the form came from, if identifiable (e.g. 'Self-referred', 'GP referral', 'The Forge'). Empty string if not stated.",
      },
      referral_goals_history: {
        type: "string",
        description:
          "Any goals for treatment and any relevant history mentioned (past injuries, surgeries, relevant medical history), combined into one field. Empty string if none mentioned.",
      },
    },
    required: [
      "presenting_complaint",
      "date_of_onset",
      "mechanism_of_injury",
      "body_region",
      "referred_via",
      "referral_goals_history",
    ],
    additionalProperties: false,
  } as const;
}

const SYSTEM_PROMPT = `You are extracting six structured fields from a clinical intake form -- exported from another clinic's booking system (Cliniko or Setmore) as a PDF, a photo, or a scanned document -- for a physiotherapist's own records.

Pull out exactly: presenting complaint / reason for referral, date of onset, mechanism of injury, body region, who referred the patient, and any goals or relevant history mentioned.

Read for what is genuinely stated on the form, never invent or infer a value that isn't there. If a field genuinely isn't present on the form, its correct output is an empty string, not a guess. This is real clinical documentation, so accuracy matters more than completeness.

The form may be a scanned image, a photo taken at an angle, or a PDF export -- read it as carefully as the quality allows, and leave a field empty rather than guess at illegible text.`;

type IntakeFileInput = { mimeType: string; buffer: Buffer };

async function buildUserContent(input: IntakeFileInput): Promise<MessageParam["content"]> {
  const { mimeType, buffer } = input;

  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const text = await extractDocxText(buffer);
    return [{ type: "text", text: `Intake form content:\n\n${text}` }];
  }

  const base64 = buffer.toString("base64");

  if (mimeType === "application/pdf") {
    return [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
      { type: "text", text: "This is the intake form to read." },
    ];
  }

  if (mimeType === "image/jpeg" || mimeType === "image/png") {
    return [
      { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } },
      { type: "text", text: "This is the intake form to read." },
    ];
  }

  throw new Error(`Unsupported intake file type: ${mimeType}`);
}

export async function extractIntakeForm(input: IntakeFileInput): Promise<IntakeFormFields> {
  const content = await buildUserContent(input);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1536,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: buildSchema() },
    },
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude.");
  }

  const parsed = JSON.parse(textBlock.text) as IntakeFormFields;

  return {
    presenting_complaint: parsed.presenting_complaint?.trim() ?? "",
    date_of_onset: parsed.date_of_onset?.trim() ?? "",
    mechanism_of_injury: parsed.mechanism_of_injury?.trim() ?? "",
    body_region: parsed.body_region?.trim() ?? "",
    referred_via: parsed.referred_via?.trim() ?? "",
    referral_goals_history: parsed.referral_goals_history?.trim() ?? "",
  };
}
