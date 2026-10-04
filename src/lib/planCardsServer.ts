import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cleanRestCodes } from "@/lib/planToBuilder";

export type IncomingPlanCard = {
  workout_id: string;
  name: string;
  plan_session: unknown;
  save_to_library?: boolean;
};

// Plan-code cards are workouts that belong to one programme. They have to
// exist before programme_workouts rows point at them. Clearing programme_id
// (save_to_library) is what puts a card in the library.
export async function savePlanCardWorkouts(programmeId: string, cards: IncomingPlanCard[] | undefined): Promise<void> {
  if (!Array.isArray(cards) || cards.length === 0) return;
  const rows = cards.map((c) => ({
    id: c.workout_id,
    name: String(c.name || "Session").slice(0, 200),
    kind: "standard",
    plan_session: c.plan_session ?? null,
    programme_id: c.save_to_library ? null : programmeId,
  }));
  const { error } = await supabaseAdmin.from("workouts").upsert(rows, { onConflict: "id" });
  if (error) throw new Error(error.message);
}

export type ProgrammeExtras = {
  intro?: string | null;
  plan_rules?: { move_on?: string; flare?: string } | null;
  week_labels?: Record<string, string> | null;
  rest_days?: number[];
};

// The columns the plan-code flow adds to a programme, as an update object.
export function programmeExtrasUpdate(extras: ProgrammeExtras): Record<string, unknown> {
  const update: Record<string, unknown> = {};
  if (extras.intro !== undefined) update.intro = extras.intro?.trim() ? extras.intro : null;
  if (extras.plan_rules !== undefined) update.plan_rules = extras.plan_rules ?? null;
  if (extras.week_labels !== undefined) update.week_labels = extras.week_labels && Object.keys(extras.week_labels).length > 0 ? extras.week_labels : null;
  if (extras.rest_days !== undefined) update.rest_days = cleanRestCodes(extras.rest_days);
  return update;
}
