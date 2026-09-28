import { NextResponse } from "next/server";
import { generateRunningPlanPdf } from "@/lib/runningPlanPdf";

// David's own copy of the same PDF a client can download -- so he can
// print it or email it himself, per the brief. No patient auth involved;
// this route only exists behind the clinic's own login.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const result = await generateRunningPlanPdf(id);
  if (!result) {
    return NextResponse.json({ error: "This isn't a running programme." }, { status: 400 });
  }

  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}
