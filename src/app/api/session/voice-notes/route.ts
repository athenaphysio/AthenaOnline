import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { transcribeAudio } from "@/lib/transcribeAudio";

// The audio arrives, goes straight to speech to text, and is never written
// anywhere; once this request ends it is gone. Only the transcript is kept.
const MAX_BYTES = 4 * 1024 * 1024;

async function currentClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Whether the button should show for this client at all. */
export async function GET() {
  const user = await currentClient();
  if (!user) return NextResponse.json({ enabled: false });
  const { data } = await supabaseAdmin
    .from("patients")
    .select("voice_notes_enabled")
    .eq("id", user.id)
    .maybeSingle<{ voice_notes_enabled: boolean }>();
  return NextResponse.json({ enabled: data?.voice_notes_enabled === true });
}

export async function POST(request: NextRequest) {
  const user = await currentClient();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  const { data: patient } = await supabaseAdmin
    .from("patients")
    .select("voice_notes_enabled")
    .eq("id", user.id)
    .maybeSingle<{ voice_notes_enabled: boolean }>();
  if (!patient?.voice_notes_enabled) return NextResponse.json({ error: "Voice notes aren't switched on for you yet." }, { status: 403 });

  const form = await request.formData();
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return NextResponse.json({ error: "Nothing was recorded." }, { status: 400 });
  if (audio.size > MAX_BYTES) return NextResponse.json({ error: "That note was too long. Try keeping it to two minutes or less." }, { status: 400 });

  const programmeId = String(form.get("programme_id") || "") || null;
  const workoutId = String(form.get("workout_id") || "") || null;
  const week = Number(form.get("week_number"));
  const day = Number(form.get("day_of_week"));
  const duration = Number(form.get("duration_seconds"));
  const contextTitle = String(form.get("context_title") || "").slice(0, 200) || null;
  const filename = String(form.get("filename") || "note.webm").replace(/[^a-z0-9.]/gi, "") || "note.webm";

  if (programmeId) {
    const { data: owned } = await supabaseAdmin
      .from("programmes")
      .select("id")
      .eq("id", programmeId)
      .eq("patient_id", user.id)
      .maybeSingle<{ id: string }>();
    if (!owned) return NextResponse.json({ error: "Programme not found." }, { status: 404 });
  }

  let transcript: string;
  try {
    transcript = (await transcribeAudio(audio, filename)).trim();
  } catch (err) {
    console.error("voice note transcription failed", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "That note couldn't be turned into text just now. Please try again, or type it in the box instead." },
      { status: 502 }
    );
  }
  if (!transcript) return NextResponse.json({ error: "No words came through on that one. Please try again a little closer to the phone." }, { status: 400 });

  const { error } = await supabaseAdmin.from("voice_notes").insert({
    patient_id: user.id,
    programme_id: programmeId,
    workout_id: workoutId,
    week_number: Number.isInteger(week) && week > 0 ? week : null,
    day_of_week: Number.isInteger(day) && day >= 1 && day <= 7 ? day : null,
    context_title: contextTitle,
    transcript,
    duration_seconds: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, transcript });
}
