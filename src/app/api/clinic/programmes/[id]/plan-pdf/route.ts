import { NextResponse } from "next/server";
import { generateProgrammePlanPdf } from "@/lib/importedPlanPdf";

// David's own copy of a client's programme as a PDF, cardio and strength
// together. No client auth involved, same footing as the other clinic PDFs.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await generateProgrammePlanPdf(id);
  if (!result) return NextResponse.json({ error: "Couldn't build the PDF." }, { status: 500 });
  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}
