import { NextRequest, NextResponse } from "next/server";
import { pauseProgrammeAccess, resumeProgrammeAccess } from "@/lib/programmeAccess";

// The manual "unassign"/"reassign" action -- pauses or resumes a
// programme's active access without touching the programme row or its
// content. See src/lib/programmeAccess.ts for the shared mechanism this
// also runs automatically when a patient's membership lapses.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { active } = body as { active?: boolean };
  if (typeof active !== "boolean") {
    return NextResponse.json({ error: "active must be a boolean." }, { status: 400 });
  }

  try {
    if (active) {
      await resumeProgrammeAccess(id);
    } else {
      await pauseProgrammeAccess(id);
    }
    return NextResponse.json({ id, active });
  } catch (err) {
    console.error("update programme access failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Update failed: ${detail}` }, { status: 500 });
  }
}
