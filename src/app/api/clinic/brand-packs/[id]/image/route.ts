import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { uploadImage } from "@/lib/imageUpload";
import { validateBrandPackImage } from "@/lib/brandPackImageValidation";
import { BRAND_PACK_COMPONENTS, type BrandPackComponentKey } from "@/lib/brandPackSpec";

const VALID_KEYS = new Set(BRAND_PACK_COMPONENTS.map((c) => c.key));

// One upload per component, keyed by the pack's own id so re-uploading a
// component overwrites the same storage path (uploadImage's upsert)
// rather than accumulating orphaned files every time David swaps an image.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const formData = await request.formData();
  const componentKey = formData.get("component");
  const image = formData.get("image");

  if (typeof componentKey !== "string" || !VALID_KEYS.has(componentKey as BrandPackComponentKey)) {
    return NextResponse.json({ error: "Unknown component." }, { status: 400 });
  }
  if (!(image instanceof Blob) || image.size === 0) {
    return NextResponse.json({ error: "Missing image." }, { status: 400 });
  }

  const key = componentKey as BrandPackComponentKey;
  const spec = BRAND_PACK_COMPONENTS.find((c) => c.key === key)!;

  try {
    const buffer = Buffer.from(await image.arrayBuffer());
    const warning = await validateBrandPackImage(key, buffer);

    const url = await uploadImage(`brand-packs/${id}`, key, image);

    const { error } = await supabaseAdmin
      .from("brand_packs")
      .update({ [spec.urlField]: url, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ url, warning });
  } catch (err) {
    console.error("brand pack image upload failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Upload failed: ${detail}` }, { status: 500 });
  }
}
