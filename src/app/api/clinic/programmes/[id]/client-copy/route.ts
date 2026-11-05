import { NextRequest, NextResponse } from "next/server";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";
import { copyWorkoutForProgramme } from "@/lib/copyProgrammeContent";

// A library session dropped onto this programme's calendar: returns the
// client's own copy to place instead, so editing it never touches the
// library. The programme may not be saved yet; its id is already fixed.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: programmeId } = await params;
  const { workout_id } = (await request.json().catch(() => ({}))) as { workout_id?: string };
  if (!workout_id) return NextResponse.json({ error: "workout_id is required." }, { status: 400 });
  try {
    const copy = await copyWorkoutForProgramme(workout_id, programmeId);
    return NextResponse.json(copy);
  } catch (err) {
    console.error("client copy failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not copy that session." }, { status: 500 });
  }
}
