import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { uploadImage } from "@/lib/imageUpload";

// Mirrors /api/clinic/audio/programme's shape exactly. The update() here is
// best-effort immediate persistence for edit mode (the row already exists);
// in create mode the template row doesn't exist yet, so this silently
// matches zero rows -- real persistence for a brand-new template happens
// when ProgrammeTemplateBuilder's own Save sends cover_image_url in its
// normal JSON payload, same pattern already relied on for audio messages.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const formData = await request.formData();
  const image = formData.get("image");

  if (!(image instanceof Blob)) {
    return NextResponse.json({ error: "Missing image." }, { status: 400 });
  }

  try {
    const url = await uploadImage("programme-templates", id, image);
    const { error } = await supabaseAdmin.from("programme_templates").update({ cover_image_url: url }).eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("programme template cover image upload failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Upload failed: ${detail}` }, { status: 500 });
  }
}
