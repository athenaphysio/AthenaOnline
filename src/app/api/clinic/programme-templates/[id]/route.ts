import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type IncomingAssignment = {
  workout_id: string;
  day_of_week: number | null;
};

type IncomingPhase = {
  name: string;
  start_week: number;
  end_week: number;
  sort_order: number;
};

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { name, block_length_weeks, assignments, phases, is_under_18, delivery_mode, access, price_gbp, cover_image_url, notes } =
    body as {
      name: string;
      block_length_weeks: number;
      assignments: IncomingAssignment[];
      phases?: IncomingPhase[];
      is_under_18?: boolean;
      delivery_mode?: "scheduled" | "open";
      access?: "paid" | "free";
      price_gbp?: number | null;
      cover_image_url?: string | null;
      notes?: string | null;
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

    if (phases !== undefined) {
      const { error: deletePhasesError } = await supabaseAdmin
        .from("programme_template_phases")
        .delete()
        .eq("programme_template_id", id);
      if (deletePhasesError) throw new Error(deletePhasesError.message);

      if (phases.length > 0) {
        const phaseRows = phases.map((p) => ({
          programme_template_id: id,
          name: p.name,
          start_week: p.start_week,
          end_week: p.end_week,
          sort_order: p.sort_order,
        }));
        const { error: phaseError } = await supabaseAdmin.from("programme_template_phases").insert(phaseRows);
        if (phaseError) throw new Error(phaseError.message);
      }
    }

    if (notes !== undefined) {
      const { error: notesError } = await supabaseAdmin
        .from("programme_template_notes")
        .upsert({ programme_template_id: id, notes: notes || null });
      if (notesError) throw new Error(notesError.message);
    }

    return NextResponse.json({ id: template.id });
  } catch (err) {
    console.error("update programme template failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Update failed: ${detail}` }, { status: 500 });
  }
}
