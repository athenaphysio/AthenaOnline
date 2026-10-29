import { NextRequest, NextResponse } from "next/server";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";
import { deletePhysicalEntry, savePhysicalEntry, storeClientDocument } from "@/lib/clientBackground";
import { PHYSICAL_SECTIONS, type PhysicalSection } from "@/lib/personMap";

// Physicality notes: a movement screen, performance scores or physiotherapy
// notes, written in, pasted, or with a file attached.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: patientId } = await params;
  const form = await request.formData();
  const section = String(form.get("section") ?? "") as PhysicalSection;
  if (!PHYSICAL_SECTIONS.some((s) => s.key === section)) return NextResponse.json({ error: "Unknown section." }, { status: 400 });
  const dated = String(form.get("dated") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dated)) return NextResponse.json({ error: "Please give it a date." }, { status: 400 });
  const title = String(form.get("title") ?? "");
  const body = String(form.get("body") ?? "");
  const file = form.get("file");
  const hasFile = file instanceof File && file.size > 0;
  const keepDocument = (form.get("document_id") as string | null) || null;
  if (!title.trim() && !body.trim() && !hasFile && !keepDocument) {
    return NextResponse.json({ error: "Write something or attach a file before saving." }, { status: 400 });
  }
  if (body.length > 100_000) return NextResponse.json({ error: "That is more text than expected for one note." }, { status: 400 });
  if (hasFile && file.size > 25_000_000) return NextResponse.json({ error: "That file is too large. Please keep it under 25 MB." }, { status: 400 });

  try {
    let documentId = keepDocument;
    if (hasFile) {
      const doc = await storeClientDocument({ patientId, kind: "physical", title: title.trim() || file.name, dated, file });
      documentId = doc.id;
    }
    const result = await savePhysicalEntry({
      patientId,
      entryId: (form.get("entry_id") as string | null) || null,
      section,
      dated,
      title,
      body,
      documentId,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("save physical entry failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: patientId } = await params;
  const entryId = request.nextUrl.searchParams.get("entry");
  if (!entryId) return NextResponse.json({ error: "Missing entry." }, { status: 400 });
  await deletePhysicalEntry(patientId, entryId);
  return NextResponse.json({ ok: true });
}
