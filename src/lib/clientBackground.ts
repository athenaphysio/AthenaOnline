import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CONTEXT_SCALES, normaliseContext, scaleMarkerKey, type ContextContent } from "@/lib/clientContext";

const BUCKET = "client-documents";

export type ClientDocument = {
  id: string;
  kind: "consultation_notes" | "questionnaire" | "other";
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
  content: ContextContent;
  anchor_statement: string | null;
  top_priority: string | null;
  first_action: string | null;
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
// Client context entries
// ---------------------------------------------------------------------------
export async function listContextEntries(patientId: string): Promise<ContextEntry[]> {
  const { data } = await supabaseAdmin
    .from("client_context_entries")
    .select("id, timepoint, consulted_on, content, anchor_statement, top_priority, first_action, source_document_id, updated_at")
    .eq("patient_id", patientId)
    .order("consulted_on", { ascending: false })
    .returns<ContextEntry[]>();
  return (data ?? []).map((e) => ({ ...e, content: normaliseContext(e.content) }));
}

export async function latestContextEntry(patientId: string): Promise<ContextEntry | null> {
  return (await listContextEntries(patientId))[0] ?? null;
}

// Saves a checked entry and passes it on to the rest of the record:
//   the scales become self report markers in the Human Passport, as drafts
//   to release from the passport page like any other result;
//   referral details fill any of the referral fields on the Overview,
//   without wiping a field the notes left empty.
export async function saveContextEntry(params: {
  patientId: string;
  entryId: string | null;
  timepoint: string;
  consultedOn: string;
  content: ContextContent;
  sourceDocumentId: string | null;
}): Promise<{ id: string; scalesSaved: number; referralFieldsFilled: number }> {
  const content = normaliseContext(params.content);
  const row = {
    patient_id: params.patientId,
    timepoint: params.timepoint,
    consulted_on: params.consultedOn,
    content,
    anchor_statement: content.anchor_statement || null,
    top_priority: content.top_priority || null,
    first_action: content.first_action || null,
    source_document_id: params.sourceDocumentId,
    updated_at: new Date().toISOString(),
  };

  let id = params.entryId;
  let previousDate: string | null = null;
  if (id) {
    const { data: before } = await supabaseAdmin
      .from("client_context_entries")
      .select("consulted_on")
      .eq("id", id)
      .eq("patient_id", params.patientId)
      .maybeSingle<{ consulted_on: string }>();
    if (!before) throw new Error("That entry no longer exists.");
    previousDate = before.consulted_on;
    const { error } = await supabaseAdmin.from("client_context_entries").update(row).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabaseAdmin.from("client_context_entries").insert(row).select("id").single<{ id: string }>();
    if (error) throw new Error(error.message);
    id = data.id;
  }

  // Scales into the passport.
  const markers = CONTEXT_SCALES.map((s, i) => ({
    marker_key: scaleMarkerKey(s.key),
    domain: s.domain,
    panel: "From your consultation",
    name: s.label,
    unit: "/10",
    explanation: `Your own rating, 0 to 10: "${s.question}"`,
    range_low: null,
    range_high: null,
    optimal_low: null,
    optimal_high: null,
    better: s.better,
    sort_order: 500 + i,
    updated_at: new Date().toISOString(),
  }));
  // Explanations written in the clinic are never overwritten.
  const { data: existingMarkers } = await supabaseAdmin
    .from("passport_markers")
    .select("marker_key, explanation")
    .in("marker_key", markers.map((m) => m.marker_key))
    .returns<{ marker_key: string; explanation: string | null }[]>();
  const keepExplanation = new Map((existingMarkers ?? []).map((m) => [m.marker_key, m.explanation]));
  const { error: markerError } = await supabaseAdmin
    .from("passport_markers")
    .upsert(markers.map((m) => (keepExplanation.get(m.marker_key) ? { ...m, explanation: keepExplanation.get(m.marker_key) } : m)), { onConflict: "marker_key" });
  if (markerError) throw new Error(markerError.message);

  // If the consultation date changed, move its readings rather than leave
  // stale copies on the old date.
  const scaleKeys = CONTEXT_SCALES.map((s) => scaleMarkerKey(s.key));
  if (previousDate && previousDate !== params.consultedOn) {
    await supabaseAdmin.from("passport_results").delete().eq("patient_id", params.patientId).eq("taken_on", previousDate).in("marker_key", scaleKeys);
  }
  const scored = content.scales.filter((s) => s.score != null);
  const unscored = content.scales.filter((s) => s.score == null).map((s) => scaleMarkerKey(s.key));
  if (unscored.length) {
    await supabaseAdmin.from("passport_results").delete().eq("patient_id", params.patientId).eq("taken_on", params.consultedOn).in("marker_key", unscored);
  }
  if (scored.length) {
    const { error } = await supabaseAdmin.from("passport_results").upsert(
      scored.map((s) => ({
        patient_id: params.patientId,
        marker_key: scaleMarkerKey(s.key),
        value: s.score,
        timepoint: params.timepoint,
        taken_on: params.consultedOn,
        source: "Onboarding consultation",
        status: "draft",
        released_at: null,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "patient_id,marker_key,taken_on" }
    );
    if (error) throw new Error(error.message);
  }

  // Referral card.
  const referralUpdate: Record<string, string> = {};
  for (const [k, v] of Object.entries(content.referral)) if (v) referralUpdate[k] = v;
  if (Object.keys(referralUpdate).length) {
    const { error } = await supabaseAdmin.from("patients").update(referralUpdate).eq("id", params.patientId);
    if (error) throw new Error(error.message);
  }

  return { id: id!, scalesSaved: scored.length, referralFieldsFilled: Object.keys(referralUpdate).length };
}

export async function deleteContextEntry(patientId: string, entryId: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from("client_context_entries")
    .select("consulted_on")
    .eq("id", entryId)
    .eq("patient_id", patientId)
    .maybeSingle<{ consulted_on: string }>();
  if (!data) return;
  // Its scales leave the passport with it.
  await supabaseAdmin
    .from("passport_results")
    .delete()
    .eq("patient_id", patientId)
    .eq("taken_on", data.consulted_on)
    .eq("source", "Onboarding consultation");
  await supabaseAdmin.from("client_context_entries").delete().eq("id", entryId);
}
