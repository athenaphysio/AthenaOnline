import { NextResponse } from "next/server";
import { getCoach } from "@/lib/coachAuth";
import { clientAccessFor, logAccess } from "@/lib/clinicianAccess";
import { documentLink } from "@/lib/clientBackground";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Opens one of a client's documents for a clinician who has "Documents"
// switched on for them, and the client has agreed to it. Anything else gets
// a plain not found, never a hint that the file exists.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;
  const coach = await getCoach();
  if (!coach) return NextResponse.json({ error: "Please log in again." }, { status: 401 });

  const access = await clientAccessFor(coach.id, id);
  if (!access || !access.sections.includes("documents")) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { data: doc } = await supabaseAdmin
    .from("client_documents")
    .select("id")
    .eq("id", docId)
    .eq("patient_id", id)
    .maybeSingle<{ id: string }>();
  if (!doc) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const link = await documentLink(doc.id);
  if (!link) return NextResponse.json({ error: "Not found." }, { status: 404 });
  await logAccess(coach.id, id, ["documents"]);
  return NextResponse.redirect(link);
}
