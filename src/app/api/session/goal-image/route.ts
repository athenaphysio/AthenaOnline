import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { uploadGoalImage, MAX_GOAL_IMAGE_BYTES } from "@/lib/programmeGoalImage";

const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

type OwnedProgramme = { id: string };

// Patient-facing upload for their own goal picture (Phase 3 -- see the
// goal picture audit). Mirrors /api/session/skip's ownership check
// (patient_id must match the signed-in user) before ever touching storage
// or the row, since this is the first patient-writable path onto the
// private patient-goal-images bucket.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const programmeId = formData.get("programme_id");

  if (!(file instanceof Blob) || !(file instanceof File) || typeof programmeId !== "string" || !programmeId) {
    return NextResponse.json({ error: "Missing file or programme_id." }, { status: 400 });
  }

  const mimeType = file.type === "image/jpg" ? "image/jpeg" : file.type;
  if (!ACCEPTED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Please choose a JPG, PNG, or WEBP image." }, { status: 400 });
  }
  if (file.size > MAX_GOAL_IMAGE_BYTES) {
    return NextResponse.json({ error: "That image is too large. Please choose one under 10MB." }, { status: 400 });
  }

  const { data: programme } = await supabase
    .from("programmes")
    .select("id")
    .eq("id", programmeId)
    .eq("patient_id", user.id)
    .maybeSingle<OwnedProgramme>();
  if (!programme) {
    return NextResponse.json({ error: "Programme not found." }, { status: 404 });
  }

  try {
    const path = await uploadGoalImage(programme.id, new Blob([await file.arrayBuffer()], { type: mimeType }));
    const { error } = await supabaseAdmin.from("programmes").update({ goal_image_path: path }).eq("id", programme.id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("goal image upload failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Couldn't save that photo: ${detail}` }, { status: 500 });
  }
}
