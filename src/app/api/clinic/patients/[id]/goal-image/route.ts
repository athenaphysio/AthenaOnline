import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { uploadGoalImage, MAX_GOAL_IMAGE_BYTES } from "@/lib/programmeGoalImage";

const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

// David setting a client's goal picture himself (Phase 4 -- see the goal
// picture audit). No auth check here: /api/clinic/:path* is already
// gated by the clinic session cookie in middleware.ts, same as the
// completion-audio upload this mirrors. programme_id must belong to the
// patient in the URL, same ownership check the patient-facing upload
// route makes against the signed-in user.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: patientId } = await params;
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

  const { data: programme } = await supabaseAdmin
    .from("programmes")
    .select("id")
    .eq("id", programmeId)
    .eq("patient_id", patientId)
    .maybeSingle<{ id: string }>();
  if (!programme) {
    return NextResponse.json({ error: "Programme not found." }, { status: 404 });
  }

  try {
    const path = await uploadGoalImage(programme.id, new Blob([await file.arrayBuffer()], { type: mimeType }));
    const { error } = await supabaseAdmin.from("programmes").update({ goal_image_path: path }).eq("id", programme.id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("clinic goal image upload failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Couldn't save that photo: ${detail}` }, { status: 500 });
  }
}
