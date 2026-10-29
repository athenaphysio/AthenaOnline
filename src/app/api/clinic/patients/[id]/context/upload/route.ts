import { NextRequest, NextResponse } from "next/server";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";
import { getClinicSettings } from "@/lib/clinicSettings";
import { storeClientDocument } from "@/lib/clientBackground";
import { extractClientContext } from "@/lib/extractClientContext";

export const maxDuration = 120;

const ACCEPTED = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
]);

// A Twofold notes file dropped in. The file is always kept on the client's
// record. When the AI tools switch is on, it is also read into the
// framework as a draft for checking; nothing is saved to the record from
// that reading until it is reviewed and saved.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: patientId } = await params;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Please choose a file." }, { status: 400 });
  const type = file.type || (file.name.toLowerCase().endsWith(".md") ? "text/markdown" : file.name.toLowerCase().endsWith(".txt") ? "text/plain" : "");
  if (!ACCEPTED.has(type)) {
    return NextResponse.json({ error: "Please drop in the notes as a PDF, Word (.docx) or text file." }, { status: 400 });
  }
  if (file.size > 15_000_000) return NextResponse.json({ error: "That file is too large. Please keep it under 15 MB." }, { status: 400 });

  try {
    const document = await storeClientDocument({
      patientId,
      kind: "consultation_notes",
      title: (form.get("title") as string | null) || file.name,
      dated: (form.get("dated") as string | null) || null,
      file,
    });

    const { aiToolsEnabled } = await getClinicSettings();
    if (!aiToolsEnabled) return NextResponse.json({ document, content: null, aiOff: true });

    const content = await extractClientContext(type, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ document, content });
  } catch (err) {
    console.error("client context upload failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `The notes could not be read: ${detail}` }, { status: 500 });
  }
}
