import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { uploadAudio } from "@/lib/audioUpload";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const exerciseId = String(formData.get("exercise_id") ?? "");
  const audio = formData.get("audio");

  if (!exerciseId || !(audio instanceof Blob)) {
    return NextResponse.json({ error: "Missing exercise_id or audio." }, { status: 400 });
  }

  try {
    const url = await uploadAudio("exercises", exerciseId, audio);
    const { error } = await supabaseAdmin
      .from("exercises")
      .update({ audio_url: url })
      .eq("exercise_id", exerciseId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("exercise audio upload failed", err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
