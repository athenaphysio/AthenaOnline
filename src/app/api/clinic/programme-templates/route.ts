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

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { id, name, block_length_weeks, assignments, phases, is_under_18, delivery_mode, access, price_gbp, cover_image_url, notes } =
    body as {
      id: string;
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

  if (!id || !name || !block_length_weeks || !Array.isArray(assignments)) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }
  // A price is only meaningful for a paid template -- never trust a client
  // to have kept these two fields in sync, so re-check here regardless of
  // what price_gbp came in.
  const resolvedAccess = access ?? "paid";
  if (resolvedAccess === "paid" && !(Number(price_gbp) > 0)) {
    return NextResponse.json({ error: "A paid template needs a price greater than zero." }, { status: 400 });
  }

  try {
    const { error: templateError } = await supabaseAdmin.from("programme_templates").insert({
      id,
      name,
      block_length_weeks,
      is_under_18: is_under_18 ?? false,
      delivery_mode: delivery_mode ?? "scheduled",
      access: resolvedAccess,
      price_gbp: resolvedAccess === "paid" ? Number(price_gbp) : null,
      cover_image_url: cover_image_url ?? null,
    });
    if (templateError) throw new Error(templateError.message);

    if (assignments.length > 0) {
      const rows = assignments.map((a) => ({
        template_id: id,
        workout_id: a.workout_id,
        day_of_week: a.day_of_week,
      }));
      const { error: assignError } = await supabaseAdmin.from("programme_template_workouts").insert(rows);
      if (assignError) throw new Error(assignError.message);
    }

    if (phases && phases.length > 0) {
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

    if (notes) {
      const { error: notesError } = await supabaseAdmin.from("programme_template_notes").insert({ programme_template_id: id, notes });
      if (notesError) throw new Error(notesError.message);
    }

    return NextResponse.json({ id });
  } catch (err) {
    console.error("create programme template failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Create failed: ${detail}` }, { status: 500 });
  }
}
