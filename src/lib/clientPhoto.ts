import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Client headshots, kept in a private bucket and shown through short lived
// links. Server only.

const BUCKET = "client-photos";
const MAX_BYTES = 400 * 1024;

// Takes the JPEG data URL made by resizePhoto in the browser, checks it
// really is a small JPEG, and stores it. Returns the storage path.
export async function storePhotoDataUrl(dataUrl: string): Promise<string> {
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("The photo needs to be a JPEG image.");
  const bytes = Buffer.from(match[1], "base64");
  if (bytes.length > MAX_BYTES) throw new Error("That photo is too large.");
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("The photo needs to be a JPEG image.");
  const path = `${randomUUID()}.jpg`;
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, bytes, { contentType: "image/jpeg" });
  if (error) throw new Error(error.message);
  return path;
}

export async function photoLink(path: string | null | undefined, seconds = 3600): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}

export async function removePhotoFile(path: string | null | undefined): Promise<void> {
  if (!path) return;
  await supabaseAdmin.storage.from(BUCKET).remove([path]);
}

// Sets (or, with null, removes) a client's headshot. The old file is
// deleted unless a registration still points at it.
export async function setClientPhoto(patientId: string, dataUrl: string | null): Promise<string | null> {
  const { data: current } = await supabaseAdmin
    .from("patients")
    .select("photo_path")
    .eq("id", patientId)
    .maybeSingle<{ photo_path: string | null }>();
  const path = dataUrl ? await storePhotoDataUrl(dataUrl) : null;
  const { error } = await supabaseAdmin.from("patients").update({ photo_path: path }).eq("id", patientId);
  if (error) {
    await removePhotoFile(path);
    throw new Error(error.message);
  }
  if (current?.photo_path) {
    const { count } = await supabaseAdmin
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("photo_path", current.photo_path);
    if (!count) await removePhotoFile(current.photo_path);
  }
  return path;
}
