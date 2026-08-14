import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { uploadImage } from "@/lib/imageUpload";
import { processEquipmentIcon } from "@/lib/equipmentIconProcessing";

// Mirrors /api/clinic/vault/exercises/[id]/cover-image, plus one extra
// step: David uploads an already-cut-out PNG (subject isolated, real
// transparency -- background removal stays his own job, confirmed with
// him rather than automated), and this runs it through the duotone-and-
// frame treatment automatically before storing it, so that half of his
// old manual process stops being manual. Always saved as a PNG regardless
// of the input format, since the framing step composites onto a raster
// canvas.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const formData = await request.formData();
  const image = formData.get("image");

  if (!(image instanceof Blob)) {
    return NextResponse.json({ error: "Missing image." }, { status: 400 });
  }

  try {
    const rawBuffer = Buffer.from(await image.arrayBuffer());
    const processed = await processEquipmentIcon(rawBuffer);
    const processedBlob = new Blob([new Uint8Array(processed)], { type: "image/png" });
    const url = await uploadImage("equipment", id, processedBlob);
    const { error } = await supabaseAdmin.from("equipment").update({ icon_url: url }).eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("equipment icon upload failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Upload failed: ${detail}` }, { status: 500 });
  }
}
