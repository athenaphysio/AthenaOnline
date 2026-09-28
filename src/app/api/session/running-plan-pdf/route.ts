import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateRunningPlanPdf } from "@/lib/runningPlanPdf";

// Runs through the patient's own authenticated client to prove ownership,
// same pattern as every other session/ route -- the PDF itself is then
// built with supabaseAdmin inside generateRunningPlanPdf, since it reads
// clinic-only tables (running_programme_state, running_rungs) a patient
// has no RLS access to directly.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const programmeId = request.nextUrl.searchParams.get("programme_id");
  if (!programmeId) {
    return NextResponse.json({ error: "programme_id is required." }, { status: 400 });
  }

  const { data: programme } = await supabase
    .from("programmes")
    .select("id")
    .eq("id", programmeId)
    .eq("patient_id", user.id)
    .maybeSingle<{ id: string }>();
  if (!programme) {
    return NextResponse.json({ error: "Programme not found." }, { status: 404 });
  }

  const result = await generateRunningPlanPdf(programmeId);
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
