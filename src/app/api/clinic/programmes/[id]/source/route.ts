import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const VALID_SOURCES = ["subscription_gated", "owned", "clinician_assigned"];

// The manual override -- every programme tags itself automatically at
// creation time (see POST /api/clinic/programmes), this is the one place
// that changes after the fact, for the rare exception (e.g. a subscribed
// patient's programme David wants to survive even if their membership
// later lapses).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { source } = body as { source?: string };
  if (!source || !VALID_SOURCES.includes(source)) {
    return NextResponse.json(
      { error: "source must be one of subscription_gated, owned, clinician_assigned." },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin.from("programmes").update({ source }).eq("id", id);
  if (error) {
    console.error("update programme source failed", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id, source });
}
