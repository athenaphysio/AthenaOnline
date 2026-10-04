import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type TidyKind = "workout" | "block" | "cardio";

export type TidyItem = {
  kind: TidyKind;
  id: string;
  name: string;
  detail: string;
  reason: string;
  /** Why this can't be deleted, or null when it's free to go. */
  usedBy: string | null;
};

const WORKOUT_LEFTOVER = /james rehab test|^test\b|\(running builder\)|running deload|^lower back|^running\s*[—–-]\s*session/i;
const BLOCK_LEFTOVER = /\(running builder\)/i;

// What still points at one library item. A row with any of these must not
// be deleted, so the screen says so and the delete skips it.
export async function usageOf(kind: TidyKind, id: string): Promise<string | null> {
  async function count(table: string, column: string): Promise<number> {
    const { count: n } = await supabaseAdmin.from(table).select("*", { count: "exact", head: true }).eq(column, id);
    return n ?? 0;
  }

  if (kind === "workout") {
    const programmes = await count("programme_workouts", "workout_id");
    if (programmes > 0) return `Used in ${programmes} saved programme${programmes === 1 ? "" : "s"}`;
    const templates = await count("programme_template_workouts", "workout_id");
    if (templates > 0) return `Used in ${templates} programme template${templates === 1 ? "" : "s"}`;
    const other: [string, string][] = [
      ["running_builder_drafts", "easy_run_workout_id"],
      ["running_builder_drafts", "quality_run_workout_id"],
      ["running_builder_drafts", "strength_workout_id"],
      ["running_builder_drafts", "cross_training_workout_id"],
      ["running_programme_state", "quality_run_workout_id"],
      ["running_programme_state", "easy_run_workout_id"],
      ["running_deload_settings", "deload_workout_id"],
      ["programme_day_overrides", "workout_id"],
    ];
    for (const [table, column] of other) {
      if ((await count(table, column)) > 0) return "Used by an older running programme";
    }
    return null;
  }
  if (kind === "block") {
    const n = await count("workout_items", "block_id");
    return n > 0 ? `Used in ${n} workout${n === 1 ? "" : "s"}` : null;
  }
  const inWorkouts = await count("workout_items", "cardio_block_id");
  if (inWorkouts > 0) return `Used in ${inWorkouts} workout${inWorkouts === 1 ? "" : "s"}`;
  const done = await count("session_completions", "cardio_block_id");
  return done > 0 ? "A client has logged it" : null;
}

function dateOf(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export async function loadTidyItems(): Promise<TidyItem[]> {
  const [{ data: workouts }, { data: blocks }, { data: cardio }] = await Promise.all([
    supabaseAdmin
      .from("workouts")
      .select("id, name, kind, created_at")
      .is("programme_id", null)
      .order("name")
      .returns<{ id: string; name: string; kind: string; created_at: string }[]>(),
    supabaseAdmin
      .from("blocks")
      .select("id, name, type, created_at")
      .order("name")
      .returns<{ id: string; name: string; type: string; created_at: string }[]>(),
    supabaseAdmin
      .from("cardio_blocks")
      .select("id, name, source_label, created_at")
      .order("name")
      .returns<{ id: string; name: string; source_label: string | null; created_at: string }[]>(),
  ]);

  const items: Omit<TidyItem, "usedBy">[] = [];

  const workoutCount = new Map<string, number>();
  for (const w of workouts ?? []) workoutCount.set(w.name.toLowerCase(), (workoutCount.get(w.name.toLowerCase()) ?? 0) + 1);
  for (const w of workouts ?? []) {
    if (!WORKOUT_LEFTOVER.test(w.name)) continue;
    const copies = workoutCount.get(w.name.toLowerCase()) ?? 1;
    items.push({
      kind: "workout",
      id: w.id,
      name: w.name,
      detail: `Workout, made ${dateOf(w.created_at)}`,
      reason: copies > 1 ? `Looks like a test or leftover, ${copies} copies` : "Looks like a test or leftover",
    });
  }

  for (const b of blocks ?? []) {
    if (!BLOCK_LEFTOVER.test(b.name)) continue;
    items.push({ kind: "block", id: b.id, name: b.name, detail: `Block, made ${dateOf(b.created_at)}`, reason: "Left over from the old Running Builder" });
  }

  const cardioCount = new Map<string, number>();
  for (const c of cardio ?? []) cardioCount.set(c.name.toLowerCase(), (cardioCount.get(c.name.toLowerCase()) ?? 0) + 1);
  for (const c of cardio ?? []) {
    const copies = cardioCount.get(c.name.toLowerCase()) ?? 1;
    if (copies <= 1 && c.source_label) continue;
    items.push({
      kind: "cardio",
      id: c.id,
      name: c.name,
      detail: `Cardio item, made ${dateOf(c.created_at)}`,
      reason: copies > 1 ? `One of ${copies} copies with the same name` : "Has no source, so it may be a test",
    });
  }

  return Promise.all(items.map(async (i) => ({ ...i, usedBy: await usageOf(i.kind, i.id) })));
}
