import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { uploadAudio } from "@/lib/audioUpload";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const programmeId = String(formData.get("programme_id") ?? "");
  const audio = formData.get("audio");

  if (!programmeId || !(audio instanceof Blob)) {
    return NextResponse.json({ error: "Missing programme_id or audio." }, { status: 400 });
  }

  try {
    const url = await uploadAudio("programmes", programmeId, audio);
    const { error } = await supabaseAdmin
      .from("programmes")
      .update({ audio_url: url })
      .eq("id", programmeId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("programme audio upload failed", err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
