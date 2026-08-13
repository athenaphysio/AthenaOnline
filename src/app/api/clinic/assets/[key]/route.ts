import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { uploadImage } from "@/lib/imageUpload";

// Mirrors /api/clinic/vault/equipment/[id]/icon exactly, except the row it
// updates is app_assets (a generic key/value store for single, site-wide
// images) rather than a specific equipment/exercise row -- see
// 0058_cardio_button_sequences.sql.
export async function POST(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const formData = await request.formData();
  const image = formData.get("image");

  if (!(image instanceof Blob)) {
    return NextResponse.json({ error: "Missing image." }, { status: 400 });
  }

  try {
    const url = await uploadImage("assets", key, image);
    const { error } = await supabaseAdmin
      .from("app_assets")
      .upsert({ key, url, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("asset upload failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Upload failed: ${detail}` }, { status: 500 });
  }
}
