import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Mirrors POST /api/clinic/blocks -- created bare (name/modality/structure
// only, client-generated id), everything else filled in afterwards via the
// inline CardioBlockEditor and persisted only when the parent Workout saves.
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { id, name, modality, modality_other, structure, category } = body as {
    id: string;
    name: string;
    modality: string;
    modality_other: string | null;
    structure: string;
    category?: string;
  };

  if (!id || !name || !modality || !structure) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  try {
    const { error } = await supabaseAdmin
      .from("cardio_blocks")
      .insert({ id, name, modality, modality_other: modality_other ?? null, structure, category: category ?? "general" });
    if (error) throw new Error(error.message);

    return NextResponse.json({ id });
  } catch (err) {
    console.error("create cardio block failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Create failed: ${detail}` }, { status: 500 });
  }
}
