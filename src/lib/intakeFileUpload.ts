import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET = "intake-forms";

function extensionFor(mimeType: string): string {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  return "bin";
}

// Unlike uploadImage/uploadAudio, this bucket is private (see
// 0046_patient_intake.sql) -- a real clinical document, not shareable
// media -- so this returns the storage path, not a public URL. Viewing it
// later means getIntakeFileSignedUrl below.
export async function uploadIntakeFile(patientId: string, id: string, file: Blob): Promise<string> {
  const mimeType = file.type || "application/octet-stream";
  const ext = extensionFor(mimeType);
  const path = `${patientId}/${id}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, arrayBuffer, {
    contentType: mimeType,
    upsert: true,
  });

  if (error) throw new Error(error.message);
  return path;
}

// A short-lived link, generated fresh each time the patient page renders --
// nothing about this bucket is ever publicly reachable on its own.
export async function getIntakeFileSignedUrl(path: string, expiresInSeconds = 300): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error) {
    console.error("failed to sign intake file url", path, error.message);
    return null;
  }
  return data.signedUrl;
}

export async function downloadIntakeFile(path: string): Promise<Blob> {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(path);
  if (error) throw new Error(error.message);
  return data;
}
