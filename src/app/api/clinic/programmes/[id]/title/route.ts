import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Rename on its own. The main PATCH on this programme also requires
// block_length_weeks and the full assignments list, and rewrites every
// programme_workouts row from it -- fine when saving the builder, far too
// much to demand when all David wants is to retitle something in the
// Recents list before assigning it.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { title } = body as { title?: string };

  if (!title || !title.trim()) {
    return NextResponse.json({ error: "A name is required." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("programmes")
    .update({ title: title.trim(), updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id, title: title.trim() });
}
