import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type IncomingAssignment = {
  workout_id: string;
  day_of_week: number | null;
};

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { name, block_length_weeks, assignments, is_under_18, delivery_mode, access, price_gbp, cover_image_url } =
    body as {
      name: string;
      block_length_weeks: number;
      assignments: IncomingAssignment[];
      is_under_18?: boolean;
      delivery_mode?: "scheduled" | "open";
      access?: "paid" | "free";
      price_gbp?: number | null;
      cover_image_url?: string | null;
    };

  if (!name || !block_length_weeks || !Array.isArray(assignments)) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }
  // Same re-check as create -- access and price_gbp always arrive together
  // from the builder (see canEditAccessAndPrice in ProgrammeTemplateBuilder),
  // so undefined means "Coach saved, leave pricing alone" and a value means
  // "Owner saved, validate it properly" regardless of what the client sent.
  if (access !== undefined && access === "paid" && !(Number(price_gbp) > 0)) {
    return NextResponse.json({ error: "A paid template needs a price greater than zero." }, { status: 400 });
  }

  try {
    const { data: template, error: templateError } = await supabaseAdmin
      .from("programme_templates")
      .update({
        name,
        block_length_weeks,
        updated_at: new Date().toISOString(),
        ...(is_under_18 !== undefined ? { is_under_18 } : {}),
        ...(delivery_mode ? { delivery_mode } : {}),
        ...(access !== undefined ? { access, price_gbp: access === "paid" ? Number(price_gbp) : null } : {}),
        ...(cover_image_url !== undefined ? { cover_image_url } : {}),
      })
      .eq("id", id)
      .select("id")
      .single();
    if (templateError) throw new Error(templateError.message);

    const { error: deleteError } = await supabaseAdmin
      .from("programme_template_workouts")
      .delete()
      .eq("template_id", id);
    if (deleteError) throw new Error(deleteError.message);

    if (assignments.length > 0) {
      const rows = assignments.map((a) => ({
        template_id: id,
        workout_id: a.workout_id,
        day_of_week: a.day_of_week,
      }));
      const { error: assignError } = await supabaseAdmin.from("programme_template_workouts").insert(rows);
      if (assignError) throw new Error(assignError.message);
    }

    return NextResponse.json({ id: template.id });
  } catch (err) {
    console.error("update programme template failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Update failed: ${detail}` }, { status: 500 });
  }
}
