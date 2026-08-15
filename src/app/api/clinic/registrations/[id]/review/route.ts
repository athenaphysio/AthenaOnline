import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// No body needed -- reviewing is a one-way flag, not an edit. Gated by
// /api/clinic/:path* in middleware.ts like every other clinic write.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { error } = await supabaseAdmin.from("registrations").update({ reviewed_at: new Date().toISOString() }).eq("id", id);
  if (error) {
    console.error("mark registration reviewed failed", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
