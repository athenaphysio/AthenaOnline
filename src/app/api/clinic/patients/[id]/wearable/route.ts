import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// The manual lever -- David's own control from the patient record, never
// automatic beyond the one Athena Athlete default (see
// fulfilMembershipCheckout in src/lib/membershipFulfillment.ts).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { enabled } = body as { enabled?: boolean };
  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be a boolean." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("patients")
    .update({ wearable_tracking_enabled: enabled })
    .eq("id", id);
  if (error) {
    console.error("update wearable tracking failed", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id, enabled });
}
