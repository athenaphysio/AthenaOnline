import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { uploadImage } from "@/lib/imageUpload";
import { processEquipmentIcon } from "@/lib/equipmentIconProcessing";

// Creates a new equipment row -- immediately available to tag onto
// exercises in the Vault builder, no separate sync step, since the
// builder's own picker just reads this same table live. Icon is optional
// at creation (David can add or replace it after, same upload control as
// every other row) but processed the same way when it is given here.
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const name = formData.get("name");
  const image = formData.get("image");

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin.from("equipment").insert({ name: name.trim() }).select("id").single<{ id: string }>();
    if (error) throw new Error(error.message);

    let iconUrl: string | null = null;
    if (image instanceof Blob && image.size > 0) {
      const rawBuffer = Buffer.from(await image.arrayBuffer());
      const processed = await processEquipmentIcon(rawBuffer);
      const processedBlob = new Blob([new Uint8Array(processed)], { type: "image/png" });
      iconUrl = await uploadImage("equipment", data.id, processedBlob);
      const { error: updateError } = await supabaseAdmin.from("equipment").update({ icon_url: iconUrl }).eq("id", data.id);
      if (updateError) throw new Error(updateError.message);
    }

    return NextResponse.json({ id: data.id, icon_url: iconUrl });
  } catch (err) {
    console.error("create equipment failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Create failed: ${detail}` }, { status: 500 });
  }
}
