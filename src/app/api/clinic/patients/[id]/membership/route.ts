import { NextRequest, NextResponse } from "next/server";
import { pauseMembership, resumeMembership } from "@/lib/membershipPause";

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
