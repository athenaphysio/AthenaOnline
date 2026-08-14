import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { CardioBaseline, CardioGoalCategory } from "@/lib/cardioGoal";

type Body = {
  cardio_goal_category: CardioGoalCategory | null;
  goal_target_id: string | null;
  target_event_date: string | null;
  baselines: CardioBaseline[];
};

// Saves the Phase 2/3 setup fields only (see
// claude_code_instructions_goal_based_cardio.md) -- not the actual
// week-by-week cardio draft, which is later, separate work. Baselines are
// upserted one row per discipline, replacing whichever ones are passed;
// a discipline missing from the payload (e.g. cycling removed by switching
// goal target) is left alone rather than guessed at here -- the panel
// itself decides which disciplines apply.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as Body;

  try {
    const { error: programmeError } = await supabaseAdmin
      .from("programmes")
      .update({
        cardio_goal_category: body.cardio_goal_category,
        goal_target_id: body.goal_target_id,
        target_event_date: body.target_event_date,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (programmeError) throw new Error(programmeError.message);

    if (body.baselines.length > 0) {
      const { error: baselineError } = await supabaseAdmin.from("programme_cardio_baselines").upsert(
        body.baselines.map((b) => ({
          programme_id: id,
          discipline: b.discipline,
          value_number: b.value_number,
          value_unit: b.value_unit,
          source: b.source,
          captured_at: new Date().toISOString(),
        })),
        { onConflict: "programme_id,discipline" }
      );
      if (baselineError) throw new Error(baselineError.message);
    }

    return NextResponse.json({ id });
  } catch (err) {
    console.error("save cardio goal failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Save failed: ${detail}` }, { status: 500 });
  }
}
