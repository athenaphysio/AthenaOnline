import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";
import { uploadImage } from "@/lib/imageUpload";

// One of a brand pack's app images: the app logo, its version for dark
// pages, the picture beside the client's greeting, or the home screen icon.
// Stored beside the pack's other images; the address that comes back is
// saved with the rest of the app settings when the pack is saved.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const form = await request.formData();
  const image = form.get("image");
  if (!(image instanceof File) || image.size === 0) return NextResponse.json({ error: "Choose an image first." }, { status: 400 });
  if (!/^image\/(jpeg|png|webp)$/.test(image.type)) return NextResponse.json({ error: "A PNG, JPEG or WebP image works best." }, { status: 400 });
  if (image.size > 5_000_000) return NextResponse.json({ error: "That image is too large. Please keep it under 5 MB." }, { status: 400 });
  try {
    const url = await uploadImage(`brand-packs/${id}/app`, randomUUID(), image);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("brand pack app image upload failed", err);
    return NextResponse.json({ error: "That image could not be uploaded. Please try again." }, { status: 500 });
  }
}
