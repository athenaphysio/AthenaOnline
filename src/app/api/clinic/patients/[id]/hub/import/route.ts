import { NextRequest, NextResponse } from "next/server";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";
import { storeClientDocument } from "@/lib/clientBackground";
import { extractHubFields } from "@/lib/extractHubFields";
import { applyHubImport } from "@/lib/onboardingHubServer";

export const maxDuration = 300;

const ALLOWED = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/jpeg",
  "image/png",
]);

// Read a document or pasted text into the consultation hub. A file is kept
// privately on the client's record, so the source of every value can be
// opened later. Everything read arrives as "to confirm".
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: patientId } = await params;
  const form = await request.formData();
  const sourceLabel = String(form.get("source") ?? "").trim().slice(0, 200);
  if (!sourceLabel) return NextResponse.json({ error: "Please say where this came from, for example the medical report and its date." }, { status: 400 });
  const file = form.get("file");
  const pasted = String(form.get("text") ?? "").trim();

  try {
    let documentId: string | null = null;
    let fileName: string | null = null;
    let result;
    if (file instanceof File && file.size > 0) {
      if (file.size > 20_000_000) return NextResponse.json({ error: "That file is too large. Please keep it under 20 MB." }, { status: 400 });
      const mimeType = file.type || "application/octet-stream";
      if (!ALLOWED.has(mimeType)) {
        return NextResponse.json({ error: "Please use a PDF, Word document, text file, or a JPEG or PNG image." }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const stored = await storeClientDocument({ patientId, kind: "other", title: sourceLabel, dated: null, file });
      documentId = stored.id;
      fileName = file.name;
      result = await extractHubFields({ mimeType, buffer }, sourceLabel);
    } else if (pasted) {
      if (pasted.length > 300_000) return NextResponse.json({ error: "That is more text than expected. Please split it." }, { status: 400 });
      result = await extractHubFields({ text: pasted }, sourceLabel);
    } else {
      return NextResponse.json({ error: "Choose a file or paste the text to read." }, { status: 400 });
    }
    const filled = await applyHubImport({
      patientId,
      sourceLabel,
      fileName,
      documentId,
      safetyNotes: result.safetyNotes,
      extracted: result.fields,
    });
    return NextResponse.json({ filled, safetyNotes: result.safetyNotes });
  } catch (err) {
    console.error("hub import failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "The document could not be read." }, { status: 500 });
  }
}
