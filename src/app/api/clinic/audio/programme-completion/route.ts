import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { uploadAudio } from "@/lib/audioUpload";

// Separate folder and column from the ongoing programme audio upload route
// -- this is the one-time "You did it" completion message, recorded after
// a scheduled block finishes, not the coaching cue heard throughout it.
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const programmeId = String(formData.get("programme_id") ?? "");
  const audio = formData.get("audio");

  if (!programmeId || !(audio instanceof Blob)) {
    return NextResponse.json({ error: "Missing programme_id or audio." }, { status: 400 });
  }

  try {
    const url = await uploadAudio("programme-completions", programmeId, audio);
    const { error } = await supabaseAdmin
      .from("programmes")
      .update({ completion_audio_url: url })
      .eq("id", programmeId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("programme completion audio upload failed", err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
