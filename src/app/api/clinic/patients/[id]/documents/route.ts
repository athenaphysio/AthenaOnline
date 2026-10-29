import { NextRequest, NextResponse } from "next/server";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";
import { storeClientDocument } from "@/lib/clientBackground";

// Store a completed questionnaire (or another document) on the client's
// record, privately.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: patientId } = await params;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Please choose a file." }, { status: 400 });
  if (file.size > 25_000_000) return NextResponse.json({ error: "That file is too large. Please keep it under 25 MB." }, { status: 400 });
  const kind = form.get("kind") === "other" ? "other" : "questionnaire";
  const dated = (form.get("dated") as string | null) || null;
  try {
    const document = await storeClientDocument({
      patientId,
      kind,
      title: (form.get("title") as string | null) || file.name,
      dated: dated && /^\d{4}-\d{2}-\d{2}$/.test(dated) ? dated : null,
      file,
    });
    return NextResponse.json({ document });
  } catch (err) {
    console.error("store client document failed", err);
    return NextResponse.json({ error: "The file could not be saved. Please try again." }, { status: 500 });
  }
}
