import { NextRequest, NextResponse } from "next/server";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";
import { storeClientDocument } from "@/lib/clientBackground";
import { extractDocxText } from "@/lib/docxText";

const ACCEPTED = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
]);

// A Twofold notes file dropped in. The file is kept privately on the
// client's record, and where it can be read as text (Word or text files)
// that text is handed back so it fills the background notes box.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: patientId } = await params;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Please choose a file." }, { status: 400 });
  const lower = file.name.toLowerCase();
  const type = file.type || (lower.endsWith(".md") ? "text/markdown" : lower.endsWith(".txt") ? "text/plain" : lower.endsWith(".docx") ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "");
  if (!ACCEPTED.has(type)) {
    return NextResponse.json({ error: "Please use a PDF, Word (.docx) or text file." }, { status: 400 });
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
    const buffer = Buffer.from(await file.arrayBuffer());
    let text: string | null = null;
    if (type === "text/plain" || type === "text/markdown") text = buffer.toString("utf8");
    else if (type.includes("wordprocessingml")) text = await extractDocxText(buffer).catch(() => null);
    return NextResponse.json({ document, text });
  } catch (err) {
    console.error("consultation notes upload failed", err);
    return NextResponse.json({ error: "The file could not be saved. Please try again." }, { status: 500 });
  }
}
