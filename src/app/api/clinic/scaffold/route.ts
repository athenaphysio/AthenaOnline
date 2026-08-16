import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { draftScaffoldPicks } from "@/lib/draftScaffold";

// A generate-a-scaffold call reasons over the whole block library with high
// effort thinking, same order of magnitude as a Block draft.
export const maxDuration = 60;

// Sensible, evenly-spread default days for N sessions/week. 1=Mon..7=Sun.
// The clinician can move any of these afterward via the day chips.
const DEFAULT_DAY_LAYOUTS: Record<number, number[]> = {
  1: [1],
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6],
  7: [1, 2, 3, 4, 5, 6, 7],
};

function titleCase(s: string): string {
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { focus, sessions_per_week, equipment, experience_level, brief, phase_id } = body as {
    focus: string;
    sessions_per_week: number;
    equipment: string;
    experience_level: string;
    brief: string;
    phase_id?: string | null;
  };

  if (!focus?.trim()) {
    return NextResponse.json({ error: "Focus is required." }, { status: 400 });
  }

  const sessionsPerWeek = Math.max(1, Math.min(7, Math.round(Number(sessions_per_week) || 1)));

  try {
    const picks = await draftScaffoldPicks({
      focus: focus.trim(),
      equipment: (equipment ?? "").trim(),
      experienceLevel: experience_level || "intermediate",
      brief: brief ?? "",
      phaseId: phase_id ?? null,
    });

    const days = DEFAULT_DAY_LAYOUTS[sessionsPerWeek];
    const focusLabel = titleCase(focus.trim());
    const created: { id: string; name: string; day_of_week: number }[] = [];

    for (let i = 0; i < sessionsPerWeek; i++) {
      const workoutId = crypto.randomUUID();
      const name = `${focusLabel} — Session ${i + 1}`;

      const { error: workoutError } = await supabaseAdmin.from("workouts").insert({ id: workoutId, name });
      if (workoutError) throw new Error(workoutError.message);

      // Deliberately no "main_body" item -- that slot stays empty for Dr
      // Silver to fill himself. Any slot the AI left null here (including
      // injury_prevention by default) simply gets no row at all.
      const items: { workout_id: string; item_order: number; slot_type: string; block_id: string }[] = [];
      let order = 1;
      if (picks.warm_up.block_id) {
        items.push({ workout_id: workoutId, item_order: order++, slot_type: "warm_up", block_id: picks.warm_up.block_id });
      }
      if (picks.activation.block_id) {
        items.push({ workout_id: workoutId, item_order: order++, slot_type: "activation", block_id: picks.activation.block_id });
      }
      if (picks.injury_prevention.block_id) {
        items.push({
          workout_id: workoutId,
          item_order: order++,
          slot_type: "injury_prevention",
          block_id: picks.injury_prevention.block_id,
        });
      }
      if (picks.cool_down.block_id) {
        items.push({ workout_id: workoutId, item_order: order++, slot_type: "cool_down", block_id: picks.cool_down.block_id });
      }

      if (items.length > 0) {
        const { error: itemsError } = await supabaseAdmin.from("workout_items").insert(items);
        if (itemsError) throw new Error(itemsError.message);
      }

      created.push({ id: workoutId, name, day_of_week: days[i] });
    }

    // David's pending-review moment for a scaffold is right here, in the
    // confirmation panel he sees immediately after generating -- picks_detail
    // is what makes that panel show real tags plus a stated reason for every
    // slot that got filled, not just an unexplained pick.
    const picksDetail = [
      { slot: "Warm-up", ...picks.warm_up },
      { slot: "Activation", ...picks.activation },
      { slot: "Cool-down", ...picks.cool_down },
      { slot: "Injury prevention", ...picks.injury_prevention },
    ].filter((p) => p.block_id);

    return NextResponse.json({ workouts: created, notices: picks.notices, context_tags: picks.context_tags, picks_detail: picksDetail });
  } catch (err) {
    console.error("generate scaffold failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Scaffold generation failed: ${detail}` }, { status: 500 });
  }
}
