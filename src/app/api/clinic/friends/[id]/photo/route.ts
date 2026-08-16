import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { uploadImage } from "@/lib/imageUpload";
import { processFriendPhoto } from "@/lib/friendPhotoProcessing";

// Same shape as the programme template cover-image route: the update()
// here is best-effort immediate persistence for edit mode (the row already
// exists); in create mode the friend row doesn't exist yet, so this
// silently matches zero rows -- real persistence for a brand-new friend
// happens when FriendForm's own Save sends photo_url in its normal JSON
// payload.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const formData = await request.formData();
  const image = formData.get("image");

  if (!(image instanceof Blob)) {
    return NextResponse.json({ error: "Missing image." }, { status: 400 });
  }

  try {
    const rawBuffer = Buffer.from(await image.arrayBuffer());
    const processed = await processFriendPhoto(rawBuffer);
    const processedBlob = new Blob([new Uint8Array(processed)], { type: "image/png" });
    const url = await uploadImage("friends", id, processedBlob);
    const { error } = await supabaseAdmin.from("friends").update({ photo_url: url }).eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("friend photo upload failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Upload failed: ${detail}` }, { status: 500 });
  }
}
