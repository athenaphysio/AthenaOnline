import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { uploadImage } from "@/lib/imageUpload";

// Mirrors /api/clinic/vault/exercises/[id]/cover-image exactly -- uploads
// David's own custom icon for one equipment item to the existing "images"
// storage bucket and stores its URL.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const formData = await request.formData();
  const image = formData.get("image");

  if (!(image instanceof Blob)) {
    return NextResponse.json({ error: "Missing image." }, { status: 400 });
  }

  try {
    const url = await uploadImage("equipment", id, image);
    const { error } = await supabaseAdmin.from("equipment").update({ icon_url: url }).eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("equipment icon upload failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Upload failed: ${detail}` }, { status: 500 });
  }
}
