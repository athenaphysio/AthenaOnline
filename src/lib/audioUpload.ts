import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function extensionFor(mimeType: string): string {
  if (mimeType.includes("mp4")) return "m4a";
  return "webm";
}

export async function uploadAudio(folder: string, id: string, file: Blob): Promise<string> {
  const ext = extensionFor(file.type);
  const path = `${folder}/${id}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error } = await supabaseAdmin.storage.from("audio").upload(path, arrayBuffer, {
    contentType: file.type || "audio/webm",
    upsert: true,
  });

  if (error) throw new Error(error.message);

  const { data } = supabaseAdmin.storage.from("audio").getPublicUrl(path);
  return data.publicUrl;
}
