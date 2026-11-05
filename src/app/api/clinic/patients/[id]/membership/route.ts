import { NextRequest, NextResponse } from "next/server";
import { pauseMembership, resumeMembership } from "@/lib/membershipPause";
import { getPatientMembership, isActiveMembership } from "@/lib/membership";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";

// Manual pause/resume from the patient's Subscriptions tab -- see
// src/lib/membershipPause.ts for what this does and doesn't touch.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: patientId } = await params;
  const body = await request.json();
  const { paused } = body as { paused?: boolean };
  if (typeof paused !== "boolean") {
    return NextResponse.json({ error: "paused must be a boolean." }, { status: 400 });
  }

  try {
    if (paused) {
      await pauseMembership(patientId);
    } else {
      await resumeMembership(patientId);
    }
    return NextResponse.json({ patientId, paused });
  } catch (err) {
    console.error("update membership pause failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}

// Read only: whether the client has an active membership, for the
// builder's checks before a programme is sent.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const membership = await getPatientMembership(id);
  return NextResponse.json({ tier: membership.tier, active: isActiveMembership(membership) });
}
