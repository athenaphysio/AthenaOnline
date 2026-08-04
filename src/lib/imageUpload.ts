import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function extensionFor(mimeType: string): string {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("gif")) return "gif";
  return "jpg";
}

export async function uploadImage(folder: string, id: string, file: Blob): Promise<string> {
  const ext = extensionFor(file.type);
  const path = `${folder}/${id}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error } = await supabaseAdmin.storage.from("images").upload(path, arrayBuffer, {
    contentType: file.type || "image/jpeg",
    upsert: true,
  });

  if (error) throw new Error(error.message);

  const { data } = supabaseAdmin.storage.from("images").getPublicUrl(path);
  return data.publicUrl;
}
