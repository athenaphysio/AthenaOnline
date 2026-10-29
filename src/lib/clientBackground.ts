import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { PhysicalSection } from "@/lib/personMap";

const BUCKET = "client-documents";

export type ClientDocument = {
  id: string;
  kind: "consultation_notes" | "questionnaire" | "physical" | "other";
  title: string;
  file_name: string;
  mime_type: string | null;
  dated: string | null;
  uploaded_at: string;
};

export type ContextEntry = {
  id: string;
  timepoint: string;
  consulted_on: string;
  summary_text: string | null;
  notes_text: string | null;
  source_document_id: string | null;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Files: kept in a private bucket, opened only through a short lived link.
// ---------------------------------------------------------------------------
export async function storeClientDocument(params: {
  patientId: string;
  kind: ClientDocument["kind"];
  title: string;
  dated: string | null;
  file: File;
}): Promise<ClientDocument> {
  const id = crypto.randomUUID();
  const safeName = params.file.name.replace(/[^\w.\-]+/g, "_").slice(-120) || "file";
  const path = `${params.patientId}/${id}/${safeName}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, Buffer.from(await params.file.arrayBuffer()), { contentType: params.file.type || "application/octet-stream" });
  if (uploadError) throw new Error(uploadError.message);

  const row = {
    id,
    patient_id: params.patientId,
    kind: params.kind,
    title: params.title.trim() || params.file.name,
    storage_path: path,
    file_name: params.file.name,
    mime_type: params.file.type || null,
    dated: params.dated,
  };
  const { data, error } = await supabaseAdmin
    .from("client_documents")
    .insert(row)
    .select("id, kind, title, file_name, mime_type, dated, uploaded_at")
    .single<ClientDocument>();
  if (error) throw new Error(error.message);
  return data;
}

export async function listClientDocuments(patientId: string, kind?: ClientDocument["kind"]): Promise<ClientDocument[]> {
  let q = supabaseAdmin
    .from("client_documents")
    .select("id, kind, title, file_name, mime_type, dated, uploaded_at")
    .eq("patient_id", patientId)
    .order("uploaded_at", { ascending: false });
  if (kind) q = q.eq("kind", kind);
  const { data } = await q.returns<ClientDocument[]>();
  return data ?? [];
}

export async function documentLink(documentId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from("client_documents").select("storage_path").eq("id", documentId).maybeSingle<{ storage_path: string }>();
  if (!data) return null;
  const { data: signed } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(data.storage_path, 120);
  return signed?.signedUrl ?? null;
}

export async function deleteClientDocument(documentId: string): Promise<void> {
  const { data } = await supabaseAdmin.from("client_documents").select("storage_path").eq("id", documentId).maybeSingle<{ storage_path: string }>();
  if (!data) return;
  await supabaseAdmin.storage.from(BUCKET).remove([data.storage_path]);
  await supabaseAdmin.from("client_documents").delete().eq("id", documentId);
}

// ---------------------------------------------------------------------------
// The person: one row per consultation, holding the Client context summary
// (written in the Twofold template) and the full background notes.
// ---------------------------------------------------------------------------
export async function listContextEntries(patientId: string): Promise<ContextEntry[]> {
  const { data } = await supabaseAdmin
    .from("client_context_entries")
    .select("id, timepoint, consulted_on, summary_text, notes_text, source_document_id, updated_at")
    .eq("patient_id", patientId)
    .order("consulted_on", { ascending: false })
    .returns<ContextEntry[]>();
  return data ?? [];
}

export async function saveConsultation(params: {
  patientId: string;
  entryId: string | null;
  timepoint: string;
  consultedOn: string;
  summary: string;
  notes: string;
  sourceDocumentId: string | null;
}): Promise<{ id: string }> {
  const row = {
    patient_id: params.patientId,
    timepoint: params.timepoint,
    consulted_on: params.consultedOn,
    summary_text: params.summary.trim() || null,
    notes_text: params.notes.trim() || null,
    source_document_id: params.sourceDocumentId,
    updated_at: new Date().toISOString(),
  };
  if (params.entryId) {
    const { data, error } = await supabaseAdmin
      .from("client_context_entries")
      .update(row)
      .eq("id", params.entryId)
      .eq("patient_id", params.patientId)
      .select("id")
      .maybeSingle<{ id: string }>();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("That consultation no longer exists.");
    return data;
  }
  const { data, error } = await supabaseAdmin.from("client_context_entries").insert(row).select("id").single<{ id: string }>();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteContextEntry(patientId: string, entryId: string): Promise<void> {
  await supabaseAdmin.from("client_context_entries").delete().eq("id", entryId).eq("patient_id", patientId);
}

// ---------------------------------------------------------------------------
// Physicality: movement screen, performance scores and physiotherapy notes.
// ---------------------------------------------------------------------------
export type PhysicalEntry = {
  id: string;
  section: PhysicalSection;
  dated: string;
  title: string | null;
  body: string | null;
  document_id: string | null;
  updated_at: string;
};

export async function listPhysicalEntries(patientId: string): Promise<PhysicalEntry[]> {
  const { data } = await supabaseAdmin
    .from("physical_capacity_entries")
    .select("id, section, dated, title, body, document_id, updated_at")
    .eq("patient_id", patientId)
    .order("dated", { ascending: false })
    .returns<PhysicalEntry[]>();
  return data ?? [];
}

export async function savePhysicalEntry(params: {
  patientId: string;
  entryId: string | null;
  section: PhysicalSection;
  dated: string;
  title: string;
  body: string;
  documentId: string | null;
}): Promise<{ id: string }> {
  const row = {
    patient_id: params.patientId,
    section: params.section,
    dated: params.dated,
    title: params.title.trim() || null,
    body: params.body.trim() || null,
    document_id: params.documentId,
    updated_at: new Date().toISOString(),
  };
  if (params.entryId) {
    const { data, error } = await supabaseAdmin
      .from("physical_capacity_entries")
      .update(row)
      .eq("id", params.entryId)
      .eq("patient_id", params.patientId)
      .select("id")
      .maybeSingle<{ id: string }>();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("That note no longer exists.");
    return data;
  }
  const { data, error } = await supabaseAdmin.from("physical_capacity_entries").insert(row).select("id").single<{ id: string }>();
  if (error) throw new Error(error.message);
  return data;
}

export async function deletePhysicalEntry(patientId: string, entryId: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from("physical_capacity_entries")
    .select("document_id")
    .eq("id", entryId)
    .eq("patient_id", patientId)
    .maybeSingle<{ document_id: string | null }>();
  if (!data) return;
  await supabaseAdmin.from("physical_capacity_entries").delete().eq("id", entryId);
  if (data.document_id) await deleteClientDocument(data.document_id).catch(() => undefined);
}
