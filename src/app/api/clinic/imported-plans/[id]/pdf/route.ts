import { NextResponse } from "next/server";
import { generateImportedPlanPdf } from "@/lib/importedPlanPdf";

// David's own copy of a client's plan PDF -- no patient auth involved,
// same footing as the old running-plan PDF's clinic-side route.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const result = await generateImportedPlanPdf(id);
  if (!result) return NextResponse.json({ error: "Couldn't build the PDF." }, { status: 500 });

  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}
