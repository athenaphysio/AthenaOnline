import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Writes straight to the direct override column on whichever kind was
// picked -- brand_pack_id: null is a real, valid choice here ("None --
// use default"), not an error, so it's read explicitly rather than
// treated as "field not sent".
export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    target_type?: "programme" | "patient";
    target_id?: string;
    brand_pack_id?: string | null;
  };

  const { target_type, target_id } = body;
  if (target_type !== "programme" && target_type !== "patient") {
    return NextResponse.json({ error: "Missing or invalid target type." }, { status: 400 });
  }
  if (!target_id) {
    return NextResponse.json({ error: "Missing target." }, { status: 400 });
  }

  const table = target_type === "programme" ? "programmes" : "patients";

  try {
    const { error } = await supabaseAdmin
      .from(table)
      .update({ brand_pack_id: body.brand_pack_id ?? null })
      .eq("id", target_id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("assign brand pack failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Assign failed: ${detail}` }, { status: 500 });
  }
}
