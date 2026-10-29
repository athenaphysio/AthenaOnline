import { NextRequest, NextResponse } from "next/server";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";
import { deleteContextEntry, saveConsultation } from "@/lib/clientBackground";

// Save a consultation: the Client context summary and the full background
// notes, as written by Dr David Silver PhD.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: patientId } = await params;
  const body = (await request.json()) as {
    entry_id?: string | null;
    timepoint?: string;
    consulted_on?: string;
    summary?: string;
    notes?: string;
    source_document_id?: string | null;
  };
  if (!body.consulted_on || !/^\d{4}-\d{2}-\d{2}$/.test(body.consulted_on)) {
    return NextResponse.json({ error: "Please give the consultation a date." }, { status: 400 });
  }
  const summary = String(body.summary ?? "");
  const notes = String(body.notes ?? "");
  if (!summary.trim() && !notes.trim() && !body.source_document_id) {
    return NextResponse.json({ error: "Add the summary, the notes, or both, before saving." }, { status: 400 });
  }
  if (summary.length > 20_000 || notes.length > 200_000) {
    return NextResponse.json({ error: "That is more text than expected for one consultation." }, { status: 400 });
  }
  const timepoint = ["baseline", "month_3", "month_6", "review"].includes(body.timepoint ?? "") ? body.timepoint! : "baseline";
  try {
    const result = await saveConsultation({
      patientId,
      entryId: body.entry_id ?? null,
      timepoint,
      consultedOn: body.consulted_on,
      summary,
      notes,
      sourceDocumentId: body.source_document_id ?? null,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("save consultation failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: patientId } = await params;
  const entryId = request.nextUrl.searchParams.get("entry");
  if (!entryId) return NextResponse.json({ error: "Missing entry." }, { status: 400 });
  await deleteContextEntry(patientId, entryId);
  return NextResponse.json({ ok: true });
}
