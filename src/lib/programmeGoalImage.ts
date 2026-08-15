import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET = "patient-goal-images";

// Same private-bucket approach as intakeFileUpload.ts -- not the public
// images bucket used for clinician-curated content (exercise covers,
// equipment icons). This is patient-uploaded material; see
// 0066_programme_goal_image.sql.
export function extensionFor(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

// 10MB -- no size limit existed anywhere to reuse (confirmed in the Phase
// 1 audit), so this is a new, deliberately generous cap: a phone photo
// comfortably fits, an accidental multi-frame HEIC burst or a mistakenly
// huge file doesn't.
export const MAX_GOAL_IMAGE_BYTES = 10 * 1024 * 1024;

export async function uploadGoalImage(programmeId: string, file: Blob): Promise<string> {
  const mimeType = file.type || "image/jpeg";
  const ext = extensionFor(mimeType);
  const path = `${programmeId}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, arrayBuffer, {
    contentType: mimeType,
    upsert: true,
  });
  if (error) throw new Error(error.message);
  return path;
}

// Short-lived, generated fresh on each render -- nothing about this
// bucket is ever publicly reachable on its own.
export async function getGoalImageSignedUrl(path: string, expiresInSeconds = 300): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error) {
    console.error("failed to sign goal image url", path, error.message);
    return null;
  }
  return data.signedUrl;
}
