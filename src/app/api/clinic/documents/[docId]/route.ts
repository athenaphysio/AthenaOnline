import { NextRequest, NextResponse } from "next/server";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";
import { deleteClientDocument, documentLink } from "@/lib/clientBackground";

// Open a stored document through a two minute private link.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ docId: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { docId } = await params;
  const link = await documentLink(docId);
  if (!link) return NextResponse.json({ error: "That document could not be found." }, { status: 404 });
  return NextResponse.redirect(link);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ docId: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { docId } = await params;
  await deleteClientDocument(docId);
  return NextResponse.json({ ok: true });
}
