import "server-only";

// Speech-to-text has no existing home in this codebase -- every other AI
// call here goes through Anthropic (src/lib/anthropic.ts), and Claude has no
// audio-transcription endpoint. OpenAI's Whisper API is the standard,
// well-documented choice for this one job, called directly via fetch rather
// than pulling in the full openai SDK for a single endpoint.
const TRANSCRIPTION_URL = "https://api.openai.com/v1/audio/transcriptions";

export async function transcribeAudio(blob: Blob, filename: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured -- voice transcription needs it set in the environment.");
  }

  const formData = new FormData();
  formData.append("file", blob, filename);
  formData.append("model", "whisper-1");

  const res = await fetch(TRANSCRIPTION_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Transcription failed (${res.status}): ${detail || res.statusText}`);
  }

  const data = (await res.json()) as { text?: string };
  if (!data.text) {
    throw new Error("Transcription returned no text.");
  }
  return data.text;
}
