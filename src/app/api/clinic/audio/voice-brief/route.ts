import { NextRequest, NextResponse } from "next/server";
import { uploadAudio } from "@/lib/audioUpload";
import { transcribeAudio } from "@/lib/transcribeAudio";

// Transcription can take a few seconds longer than the other audio routes'
// simple storage upload, so this gets its own generous ceiling.
export const maxDuration = 60;

// Not tied to any programme yet -- this runs before one exists, so unlike
// the other two audio routes there's no db row to update, just a fresh
// storage path (a random id, purely for pathing) and a transcript handed
// straight back for the clinician to confirm before anything else happens.
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const audio = formData.get("audio");

  if (!(audio instanceof Blob)) {
    return NextResponse.json({ error: "Missing audio." }, { status: 400 });
  }

  try {
    const id = crypto.randomUUID();
    const [url, transcript] = await Promise.all([
      uploadAudio("voice-briefs", id, audio),
      transcribeAudio(audio, "recording.webm"),
    ]);
    return NextResponse.json({ url, transcript });
  } catch (err) {
    console.error("voice brief processing failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
