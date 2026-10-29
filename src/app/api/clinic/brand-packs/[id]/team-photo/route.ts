import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";
import { uploadImage } from "@/lib/imageUpload";

// A photo for one member of a brand pack's team. Stored beside the pack's
// other images; the address that comes back is saved with the team when
// the pack is saved.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const form = await request.formData();
  const image = form.get("image");
  if (!(image instanceof File) || image.size === 0) return NextResponse.json({ error: "Choose a photo first." }, { status: 400 });
  if (!/^image\/(jpeg|png|webp)$/.test(image.type)) return NextResponse.json({ error: "A JPEG, PNG or WebP photo works best." }, { status: 400 });
  if (image.size > 5_000_000) return NextResponse.json({ error: "That photo is too large. Please keep it under 5 MB." }, { status: 400 });
  try {
    const url = await uploadImage(`brand-packs/${id}/team`, randomUUID(), image);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("team photo upload failed", err);
    return NextResponse.json({ error: "That photo could not be uploaded. Please try again." }, { status: 500 });
  }
}
