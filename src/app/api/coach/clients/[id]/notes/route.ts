import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCoach } from "@/lib/coachAuth";
import { clientAccessFor } from "@/lib/clinicianAccess";

// A clinician adds a care team note. Allowed only when they may add notes
// for this client and may see the section the note belongs to.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const coach = await getCoach();
  if (!coach) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  const { id: patientId } = await params;
  const { section, body } = (await request.json()) as { section?: string; body?: string };

  const access = await clientAccessFor(coach.id, patientId);
  if (!access || !access.sections.includes("write_notes") || !section || section === "write_notes" || !access.sections.includes(section as never)) {
    return NextResponse.json({ error: "You cannot add notes here." }, { status: 403 });
  }
  if (!body?.trim()) return NextResponse.json({ error: "The note is empty." }, { status: 400 });

  const { error } = await supabaseAdmin.from("care_notes").insert({
    patient_id: patientId,
    package_id: access.packageId,
    section,
    staff_id: coach.id,
    author_name: coach.name || coach.email,
    body: body.trim().slice(0, 5000),
  });
  if (error) return NextResponse.json({ error: "The note could not be saved." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
