import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { uploadImage } from "@/lib/imageUpload";

// Mirrors /api/clinic/programme-templates/[id]/cover-image's shape exactly.
// Used as the fallback when Vimeo's oEmbed lookup can't find a thumbnail
// (private video, bad link) -- the Vault grid prefers this stored cover
// over the live oEmbed lookup whenever it's present.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const formData = await request.formData();
  const image = formData.get("image");

  if (!(image instanceof Blob)) {
    return NextResponse.json({ error: "Missing image." }, { status: 400 });
  }

  try {
    const url = await uploadImage("exercises", id, image);
    const { error } = await supabaseAdmin.from("exercises").update({ thumbnail_url: url }).eq("exercise_id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("exercise cover image upload failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Upload failed: ${detail}` }, { status: 500 });
  }
}
