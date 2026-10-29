import { NextRequest, NextResponse } from "next/server";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";
import { deleteContextEntry, saveContextEntry } from "@/lib/clientBackground";
import type { ContextContent } from "@/lib/clientContext";

// Save a checked Client context entry, which also passes its scales to the
// passport and its referral details to the Overview.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: patientId } = await params;
  const body = (await request.json()) as {
    entry_id?: string | null;
    timepoint?: string;
    consulted_on?: string;
    content?: ContextContent;
    source_document_id?: string | null;
  };
  if (!body.content || !body.consulted_on || !/^\d{4}-\d{2}-\d{2}$/.test(body.consulted_on)) {
    return NextResponse.json({ error: "Please give the consultation a date." }, { status: 400 });
  }
  const timepoint = ["baseline", "month_3", "month_6", "review"].includes(body.timepoint ?? "") ? body.timepoint! : "baseline";
  try {
    const result = await saveContextEntry({
      patientId,
      entryId: body.entry_id ?? null,
      timepoint,
      consultedOn: body.consulted_on,
      content: body.content,
      sourceDocumentId: body.source_document_id ?? null,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("save client context failed", err);
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
